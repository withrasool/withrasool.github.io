(function () {
  // ==== تنظیمات Supabase (این دو مقدار را از داشبورد Supabase کپی کن) ====
  const SUPABASE_URL = 'https://https://cdlptnfwhpyzaopetqej.supabase.co/rest/v1/.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHB0bmZ3aHB5emFvcGV0cWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNTEzNDQsImV4cCI6MjEwOTcyNzM0NH0.UD3682rP0aP1p5QmXS6gCPP0Nkcqf_MMY7hwgQqkNqU';
  // ======================================================================

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

  async function loadList(slug) {
    const list = document.getElementById('commentList');
    const { data, error } = await sb.from('comments')
      .select('author_name, body, created_at')
      .eq('article_slug', slug)
      .order('created_at', { ascending: false })
      .limit(100);
    list.innerHTML = '';
    if (error) { list.textContent = 'خطا در بارگذاری نظرها.'; return; }
    if (!data.length) { list.textContent = 'هنوز نظری ثبت نشده است.'; return; }
    data.forEach(c => {
      const card = document.createElement('div');
      card.className = 'card rounded-2xl p-5 mb-4';
      const head = document.createElement('p');
      head.className = 'text-sm text-blue-300 mb-2';
      head.textContent = c.author_name + ' — ' + new Date(c.created_at).toLocaleDateString('fa-IR');
      const txt = document.createElement('p');
      txt.className = 'text-blue-100 leading-loose';
      txt.textContent = c.body;
      card.append(head, txt);
      list.append(card);
    });
  }

  async function initComments() {
    const box = document.getElementById('comments');
    if (!box) return;
    const slug = box.dataset.article;
    const user = await refreshNav();
    const form = document.getElementById('commentForm');
    const note = document.getElementById('loginNote');

    if (user) {
      form.classList.remove('hidden');
      note.classList.add('hidden');
    } else {
      form.classList.add('hidden');
      note.classList.remove('hidden');
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = form.body.value.trim();
      if (!body) return;
      const { data: profile } = await sb.from('profiles').select('full_name').eq('id', user.id).single();
      const { error } = await sb.from('comments').insert({
        article_slug: slug,
        user_id: user.id,
        author_name: (profile && profile.full_name) || 'کاربر',
        body: body
      });
      if (error) { alert('خطا در ثبت نظر: ' + error.message); return; }
      form.body.value = '';
      loadList(slug);
    };

    loadList(slug);
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshNav();
    initComments();
  });
  sb.auth.onAuthStateChange(() => { refreshNav(); });
})();
