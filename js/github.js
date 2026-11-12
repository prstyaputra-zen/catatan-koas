// Akses repo data PRIVAT (feed Auto updates, gambar, permintaan catatan, jenis & stase) lewat GitHub API.
// Kode aplikasi ada di repo publik; data tidak. Token fine-grained (Contents: read & write, hanya repo data)
// disimpan di perangkat, ikut sinkron Drive terenkripsi, dan hanya dikirim ke api.github.com.

const API = 'https://api.github.com';
const COMMITTER = { name: 'Prasetya', email: '337586035+prstyaputra-zen@users.noreply.github.com' };

export const githubRepo = () => window.CATATAN_CONFIG?.dataRepo || 'prstyaputra-zen/catatan-koas-data';

function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function gh(token, path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
  });
  if (res.status === 401) throw new Error('Token GitHub ditolak (salah atau kedaluwarsa)');
  if (res.status === 403) throw new Error('Token GitHub tidak punya izin menulis ke repo ini');
  return res;
}

// Memastikan token bisa menulis ke repo. Mengembalikan nama repo.
export async function checkToken(token) {
  const res = await gh(token, `/repos/${githubRepo()}`);
  if (res.status === 404) throw new Error('Repo tidak ditemukan atau token tidak diberi akses ke repo ini');
  if (!res.ok) throw new Error('GitHub menjawab HTTP ' + res.status);
  const repo = await res.json();
  if (repo.permissions && !repo.permissions.push) throw new Error('Token hanya bisa membaca. Beri izin Contents: Read and write.');
  return repo.full_name;
}

const contentsPath = (file) => `/repos/${githubRepo()}/contents/${file.split('/').map(encodeURIComponent).join('/')}`;

// Isi mentah sebuah file sebagai Blob (gambar, atau JSON > 1 MB). null bila tidak ada.
export async function readRaw(token, file) {
  const res = await gh(token, contentsPath(file), { headers: { Accept: 'application/vnd.github.raw' } });
  if (res.status === 404) return null;
  if (!res.ok) throw Object.assign(new Error('Gagal membaca ' + file + ': HTTP ' + res.status), { permanent: false });
  return res.blob();
}

// Membaca file JSON di cabang utama. Mengembalikan { data, sha } atau { data: null, sha: null } bila belum ada.
export async function readJson(token, file) {
  const res = await gh(token, contentsPath(file));
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new Error('Gagal membaca ' + file + ': HTTP ' + res.status);
  const j = await res.json();
  // File > 1 MB tidak menyertakan isi di respons ini.
  const text = j.content && j.encoding === 'base64' ? b64decode(j.content) : await (await readRaw(token, file)).text();
  return { data: JSON.parse(text), sha: j.sha };
}

// Mengubah file JSON dengan aman terhadap penulis lain (rutin AI): baca, ubah, tulis; ulangi bila bentrok.
// mutate(data|null) mengembalikan data baru, atau undefined untuk membatalkan.
export async function updateJson(token, file, mutate, message) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, sha } = await readJson(token, file);
    const next = mutate(data ? structuredClone(data) : null);
    if (next === undefined) return data;
    const res = await gh(token, contentsPath(file), {
      method: 'PUT',
      body: JSON.stringify({ message, content: b64encode(JSON.stringify(next, null, 1) + '\n'), committer: COMMITTER, ...(sha ? { sha } : {}) }),
    });
    if (res.ok) return next;
    if (res.status !== 409 && res.status !== 422) throw new Error('Gagal menyimpan ' + file + ': HTTP ' + res.status);
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  throw new Error('Gagal menyimpan ' + file + ': bentrok dengan perubahan lain, coba lagi');
}
