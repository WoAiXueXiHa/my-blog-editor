(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BlogCMSValidation = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const actions = 'https://github.com/WoAiXueXiHa/my-blog/actions/workflows/quality.yml';
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function originalSlug(path, hash) {
    const source = path || (hash || '').match(/\/entries\/(.*)$/)?.[1] || '';
    const cleaned = decodeURIComponent(source).replace(/^content\/posts\//, '').replace(/\/index(?:\.md)?$/, '');
    return slugPattern.test(cleaned) ? cleaned : '';
  }

  function validate(data, context) {
    const errors = [];
    const mode = context.mode;
    const slug = String(data.slug || '').trim();
    const original = originalSlug(context.path, context.hash);
    for (const [key, label] of [['title', '标题'], ['topic', '主题'], ['summary', '摘要']]) {
      const value = String(data[key] || '');
      if (!value.trim()) errors.push(`${label}不能为空`);
      else if ((key === 'title' || key === 'summary') && value !== value.trim()) errors.push(`${label}首尾不能有空白`);
    }
    for (const [key, label] of [['categories', '分类'], ['tags', '标签']]) {
      if (!Array.isArray(data[key]) || !data[key].some(item => String(item || '').trim())) errors.push(`至少填写一项${label}`);
    }
    if (data.draft !== false) errors.push('发布状态必须为 draft: false');
    for (const [key, label] of [['date', '发布时间'], ['lastmod', '修改时间']]) {
      const raw = data[key] instanceof Date ? data[key].toISOString() : String(data[key] || '');
      const parsed = Date.parse(raw);
      const parts = raw.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?(Z|[+-]\d\d:\d\d)$/);
      const dayValid = parts && +parts[2] >= 1 && +parts[2] <= 12 && +parts[3] >= 1 && +parts[3] <= new Date(Date.UTC(+parts[1], +parts[2], 0)).getUTCDate() && +parts[4] <= 23 && +parts[5] <= 59 && +(parts[6] || 0) <= 59 && (parts[7] === 'Z' || (+parts[7].slice(1, 3) <= 23 && +parts[7].slice(4) <= 59));
      if (!dayValid || !Number.isFinite(parsed)) errors.push(`${label}须为带时区的合法日期`);
      else if (parsed > Date.now()) errors.push(`${label}不能晚于当前时间`);
    }
    if (Array.isArray(data.series) && data.series.length && (!Number.isInteger(Number(data.seriesOrder)) || Number(data.seriesOrder) < 1)) errors.push('系列文章须填写正整数系列序号');
    const body = String(data.body || '');
    if (/^#\s+/m.test(body)) errors.push('正文不能包含一级标题，请从 ## 开始');
    if ((body.match(/^```/gm) || []).length % 2) errors.push('代码围栏未闭合');
    for (const match of body.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
      if (!match[1].trim()) errors.push('图片须填写说明文字');
      if (/^https?:\/\//i.test(match[2])) errors.push('图片不能使用外链，请上传到文章目录');
    }
    if (mode === 'edit') {
      if (context.newRecord) errors.push('旧文入口不能新建文章');
      if (!original) errors.push('无法确认旧文章原路径，已阻止保存');
      if (slug && slug !== original) errors.push(`旧文章路径已锁定为 ${original}，请勿修改英文路径`);
    } else {
      if (!slugPattern.test(slug)) errors.push('英文路径只能使用小写字母、数字和连字符');
      if (!context.newRecord && !context.createdInSession?.has(original)) errors.push('新建入口不能修改历史文章，请使用旧文入口');
      if (!context.newRecord && original && slug !== original) errors.push('已创建文章的路径不能修改');
    }
    return [...new Set(errors)];
  }

  function register(CMS, mode) {
    const createdInSession = new Set();
    const test = mode === 'sandbox-new' || mode === 'sandbox-edit';
    const editing = mode === 'edit' || mode === 'sandbox-edit';
    CMS.registerEventListener({ name: 'preSave', handler: ({ entry }) => {
      const data = entry.get('data').toJS();
      const errors = validate(data, { mode: editing ? 'edit' : 'new', path: entry.get('path'), hash: location.hash, newRecord: entry.get('newRecord'), createdInSession });
      if (errors.length) throw new Error('保存前校验失败：\n' + errors.map((error, index) => `${index + 1}. ${error}`).join('\n'));
      return entry.get('data');
    }});
    CMS.registerEventListener({ name: 'postSave', handler: ({ entry }) => {
      if (!editing && entry.get('newRecord')) {
        const slug = String(entry.get('data').get('slug') || '');
        if (slugPattern.test(slug)) createdInSession.add(slug);
      }
      const note = document.getElementById('cms-save-state');
      if (note) note.innerHTML = `已提交到 GitHub；请到 <a href="${actions}" target="_blank" rel="noopener noreferrer">Actions</a> 确认检查通过，再查看线上文章。${test ? ' 此入口写入测试分支，不会上线。' : ''}`;
    }});
    document.addEventListener('DOMContentLoaded', () => {
      const note = document.createElement('div');
      note.id = 'cms-save-state';
      note.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:8px 12px;background:#17324d;color:#fff;font:14px/1.5 sans-serif;text-align:center';
      note.innerHTML = `保存仅代表提交 GitHub；<a href="${actions}" target="_blank" rel="noopener noreferrer">Actions 通过后才会上线</a>。${test ? '当前为测试分支，不会上线。' : ''}复杂 Markdown 请用原文模式，切换可视化模式后核对差异。`;
      note.querySelectorAll('a').forEach(a => a.style.color = '#aee7ff');
      document.body.appendChild(note);
    });
  }
  return { validate, originalSlug, register };
});
