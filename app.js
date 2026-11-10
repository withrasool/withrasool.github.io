(function () {
  // ==== تنظیمات Supabase: دو خط زیر را از فایل app.js قبلی خودت کپی و جایگزین کن ====
  const SUPABASE_URL = 'https://cdlptnfwhpyzaopetqej.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHB0bmZ3aHB5emFvcGV0cWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNTEzNDQsImV4cCI6MjEwOTcyNzM0NH0.UD3682rP0aP1p5QmXS6gCPP0Nkcqf_MMY7hwgQqkNqU';
  // ================================================================================

  if (!window.supabase) return;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = sb;

  async function refreshNav() {
    const { data: { user } } = await sb.auth.getUser();
    document.querySelectorAll('[data-auth-link]').forEach(a => {
      if (user) {
        a.textContent = 'خروج';
        a.href = '#';
        a.onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
      } else {
        a.textContent = 'ورود';
        a.href = a.dataset.authLink;
        a.onclick = null;
      }
    });
    return user;
  }

  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const btnClass = 'px-3 py-1 rounded-lg border border-blue-300/20 text-blue-200 hover:bg-white/5 transition';
  const btnActive = 'px-3 py-1 rounded-lg bg-blue-600 text-white border border-blue-600';

  async function loadComments(ctx) {
    const list = document.getElementById('commentList');
    list.innerHTML = '';
    const { data: comments, error } = await sb.from('comments')
      .select('id, parent_id, author_name, body, created_at, user_id')
      .eq('article_slug', ctx.slug)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) { list.textContent = 'خطا در بارگذاری نظرها: ' + error.message; return; }
    if (!comments.length) { list.textContent = 'هنوز نظری ثبت نشده است.'; return; }

    const ids = comments.map(c => c.id);
    const { data: reactions } = await sb.from('reactions')
      .select('comment_id, user_id, value')
      .in('comment_id', ids);

    const likes = {}, dislikes = {}, mine = {};
    (reactions || []).forEach(r => {
      if (r.value === 1) likes[r.comment_id] = (likes[r.comment_id] || 0) + 1;
      else dislikes[r.comment_id] = (dislikes[r.comment_id] || 0) + 1;
      if (ctx.user && r.user_id === ctx.user.id) mine[r.comment_id] = r.value;
    });

    const replies = {};
    comments.filter(c => c.parent_id).forEach(c => {
      (replies[c.parent_id] = replies[c.parent_id] || []).push(c);
    });

    const roots = comments.filter(c => !c.parent_id).reverse();
    roots.forEach(c => {
      const block = renderComment(c, false, { ctx, likes, dislikes, mine });
      (replies[c.id] || []).forEach(r => {
        block.append(renderComment(r, true, { ctx, likes, dislikes, mine }));
      });
      list.append(block);
    });
  }

  function renderComment(c, isReply, env) {
    const { ctx, likes, dislikes, mine } = env;
    const wrap = mk('div', 'card rounded-2xl p-5 mb-4' + (isReply ? ' mr-6 md:mr-10 border-r-2 border-r-blue-300/40' : ''));

    wrap.append(mk('p', 'text-sm text-blue-300 mb-2', c.author_name + ' — ' + new Date(c.created_at).toLocaleDateString('fa-IR')));
    wrap.append(mk('p', 'text-blue-100 leading-loose mb-3', c.body));

    const bar = mk('div', 'flex flex-wrap gap-2 text-sm');

    const likeBtn = mk('button', mine[c.id] === 1 ? btnActive : btnClass, '👍 ' + (likes[c.id] || 0));
    likeBtn.onclick = () => react(c.id, 1, ctx);
    const dislikeBtn = mk('button', mine[c.id] === -1 ? btnActive : btnClass, '👎 ' + (dislikes[c.id] || 0));
    dislikeBtn.onclick = () => react(c.id, -1, ctx);
    bar.append(likeBtn, dislikeBtn);

    if (!isReply && ctx.user) {
      const replyBtn = mk('button', btnClass, 'پاسخ');
      bar.append(replyBtn);
      const replyBox = mk('div', 'hidden mt-3 w-full');
      const ta = mk('textarea', 'w-full rounded-xl px-3 py-2 bg-white/5 border border-blue-300/20 text-white');
      ta.rows = 3; ta.maxLength = 1000; ta.placeholder = 'پاسخ خود را بنویسید...';
      const send = mk('button', 'mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold', 'ارسال پاسخ');
      send.onclick = async () => {
        const body = ta.value.trim();
        if (!body) return;
        const { error } = await sb.from('comments').insert({
          article_slug: ctx.slug, user_id: ctx.user.id, author_name: ctx.name, body: body, parent_id: c.id
        });
        if (error) { alert('خطا: ' + error.message); return; }
        loadComments(ctx);
      };
      replyBox.append(ta, send);
      replyBtn.onclick = () => replyBox.classList.toggle('hidden');
      wrap.append(bar, replyBox);
    } else {
      wrap.append(bar);
    }

    if (ctx.user && c.user_id === ctx.user.id) {
      const del = mk('button', 'mt-3 text-xs text-red-300 hover:text-red-200', 'حذف نظر من');
      del.onclick = async () => {
        if (!confirm('این نظر حذف شود؟')) return;
        const { error } = await sb.from('comments').delete().eq('id', c.id);
        if (error) { alert('خطا: ' + error.message); return; }
        loadComments(ctx);
      };
      wrap.append(del);
    }
    return wrap;
  }

  async function react(commentId, value, ctx) {
    if (!ctx.user) { alert('برای لایک یا دیس‌لایک ابتدا وارد شوید.'); return; }
    const { data: existing } = await sb.from('reactions')
      .select('id, value').eq('comment_id', commentId).eq('user_id', ctx.user.id).maybeSingle();
    if (existing && existing.value === value) {
      await sb.from('reactions').delete().eq('id', existing.id);
    } else {
      await sb.from('reactions').upsert(
        { comment_id: commentId, user_id: ctx.user.id, value: value },
        { onConflict: 'comment_id,user_id' }
      );
    }
    loadComments(ctx);
  }

  async function initComments() {
    const box = document.getElementById('comments');
    if (!box) return;
    const user = await refreshNav();
    const ctx = { slug: box.dataset.article, user: user, name: 'کاربر' };

    if (user) {
      const { data: p } = await sb.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      if (p && p.full_name) ctx.name = p.full_name;
    }

    const form = document.getElementById('commentForm');
    const note = document.getElementById('loginNote');
    form.classList.toggle('hidden', !user);
    note.classList.toggle('hidden', !!user);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = form.body.value.trim();
      if (!body) return;
      const { error } = await sb.from('comments').insert({
        article_slug: ctx.slug, user_id: user.id, author_name: ctx.name, body: body
      });
      if (error) { alert('خطا در ثبت نظر: ' + error.message); return; }
      form.body.value = '';
      loadComments(ctx);
    };

    loadComments(ctx);
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshNav();
    initComments();
  });
  sb.auth.onAuthStateChange(() => { refreshNav(); });
})();
