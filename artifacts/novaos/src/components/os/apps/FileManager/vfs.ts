import { VFSNode, MimeCategory } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getMimeCategory(mimeType: string): MimeCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/csv'
  )
    return 'document';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    mimeType.includes('dmg')
  )
    return 'archive';
  if (
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('html') ||
    mimeType.includes('css') ||
    mimeType.includes('python') ||
    mimeType.includes('java')
  )
    return 'code';
  return 'other';
}

export function inferMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    rar: 'application/vnd.rar',
    dmg: 'application/x-apple-diskimage',
    js: 'application/javascript',
    ts: 'application/typescript',
    json: 'application/json',
    html: 'text/html',
    css: 'text/css',
    py: 'text/x-python',
  };
  return map[ext] ?? 'application/octet-stream';
}

let _idCounter = 1000;
export function genId() {
  return `node_${Date.now()}_${_idCounter++}`;
}

function makeFile(
  overrides: Partial<VFSNode> & { id: string; name: string; parentId: string; size: number }
): VFSNode {
  const mimeType = overrides.mimeType ?? inferMimeType(overrides.name);
  return {
    type: 'file',
    children: [],
    createdAt: Date.now() - Math.random() * 30 * 86400000,
    modifiedAt: Date.now() - Math.random() * 7 * 86400000,
    mimeType,
    mimeCategory: getMimeCategory(mimeType),
    isFavorite: false,
    ...overrides,
  };
}

function makeFolder(
  overrides: Partial<VFSNode> & { id: string; name: string; parentId: string | null; children: string[] }
): VFSNode {
  return {
    type: 'folder',
    size: 0,
    mimeType: 'inode/directory',
    mimeCategory: 'other',
    createdAt: Date.now() - Math.random() * 60 * 86400000,
    modifiedAt: Date.now() - Math.random() * 10 * 86400000,
    isFavorite: false,
    ...overrides,
  };
}

// ─── Initial VFS ────────────────────────────────────────────────────────────

export const ROOT_ID = 'root';
export const HOME_ID = 'home';
export const DOCUMENTS_ID = 'documents';
export const PICTURES_ID = 'pictures';
export const MUSIC_ID = 'music';
export const DOWNLOADS_ID = 'downloads';
export const DESKTOP_ID = 'deskfolder';
export const VIDEOS_ID = 'videos';
export const SCREENSHOTS_ID = 'screenshots';
export const PROJECTS_ID = 'projects';

export function buildInitialVFS(): Record<string, VFSNode> {
  const nodes: VFSNode[] = [
    // Root
    makeFolder({ id: ROOT_ID, name: 'NovaOS', parentId: null, children: [HOME_ID, DOWNLOADS_ID, 'applications'] }),

    // Home
    makeFolder({ id: HOME_ID, name: 'Home', parentId: ROOT_ID, children: [DOCUMENTS_ID, PICTURES_ID, MUSIC_ID, VIDEOS_ID, DESKTOP_ID, PROJECTS_ID], isFavorite: true }),

    // Documents
    makeFolder({ id: DOCUMENTS_ID, name: 'Documents', parentId: HOME_ID, children: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6'], isFavorite: true }),
    makeFile({ id: 'doc1', name: 'Project Proposal.pdf', parentId: DOCUMENTS_ID, size: 2_480_000 }),
    makeFile({ id: 'doc2', name: 'Meeting Notes.txt', parentId: DOCUMENTS_ID, size: 14_200 }),
    makeFile({ id: 'doc3', name: 'Budget 2024.xlsx', parentId: DOCUMENTS_ID, size: 398_000 }),
    makeFile({ id: 'doc4', name: 'Resume.docx', parentId: DOCUMENTS_ID, size: 87_400 }),
    makeFile({ id: 'doc5', name: 'Design Brief.pdf', parentId: DOCUMENTS_ID, size: 1_200_000 }),
    makeFile({ id: 'doc6', name: 'TODO.md', parentId: DOCUMENTS_ID, size: 3_200 }),

    // Pictures
    makeFolder({ id: PICTURES_ID, name: 'Pictures', parentId: HOME_ID, children: [SCREENSHOTS_ID, 'pic1', 'pic2', 'pic3', 'pic4'], isFavorite: true }),
    makeFolder({ id: SCREENSHOTS_ID, name: 'Screenshots', parentId: PICTURES_ID, children: ['ss1', 'ss2', 'ss3'] }),
    makeFile({ id: 'ss1', name: 'Screenshot 2024-01-15.png', parentId: SCREENSHOTS_ID, size: 1_840_000 }),
    makeFile({ id: 'ss2', name: 'Screenshot 2024-01-20.png', parentId: SCREENSHOTS_ID, size: 2_100_000 }),
    makeFile({ id: 'ss3', name: 'Screenshot 2024-02-01.png', parentId: SCREENSHOTS_ID, size: 1_650_000 }),
    makeFile({ id: 'pic1', name: 'Wallpaper.jpg', parentId: PICTURES_ID, size: 4_200_000 }),
    makeFile({ id: 'pic2', name: 'Profile Photo.jpg', parentId: PICTURES_ID, size: 920_000 }),
    makeFile({ id: 'pic3', name: 'Holiday 2023.jpg', parentId: PICTURES_ID, size: 3_800_000 }),
    makeFile({ id: 'pic4', name: 'Logo.svg', parentId: PICTURES_ID, size: 48_200 }),

    // Music
    makeFolder({ id: MUSIC_ID, name: 'Music', parentId: HOME_ID, children: ['mus1', 'mus2', 'mus3', 'mus4'] }),
    makeFile({ id: 'mus1', name: 'Midnight Drive.mp3', parentId: MUSIC_ID, size: 8_400_000 }),
    makeFile({ id: 'mus2', name: 'Chill Vibes.flac', parentId: MUSIC_ID, size: 42_000_000 }),
    makeFile({ id: 'mus3', name: 'Podcast Episode 1.mp3', parentId: MUSIC_ID, size: 64_000_000 }),
    makeFile({ id: 'mus4', name: 'Morning Playlist.m3u', parentId: MUSIC_ID, size: 2_400 }),

    // Videos
    makeFolder({ id: VIDEOS_ID, name: 'Videos', parentId: HOME_ID, children: ['vid1', 'vid2'] }),
    makeFile({ id: 'vid1', name: 'Demo Recording.mp4', parentId: VIDEOS_ID, size: 180_000_000 }),
    makeFile({ id: 'vid2', name: 'Tutorial.mov', parentId: VIDEOS_ID, size: 340_000_000 }),

    // Desktop folder
    makeFolder({ id: DESKTOP_ID, name: 'Desktop', parentId: HOME_ID, children: ['desk1', 'desk2'] }),
    makeFile({ id: 'desk1', name: 'Quick Notes.txt', parentId: DESKTOP_ID, size: 8_200 }),
    makeFile({ id: 'desk2', name: 'Untitled.md', parentId: DESKTOP_ID, size: 420 }),

    // Projects
    makeFolder({ id: PROJECTS_ID, name: 'Projects', parentId: HOME_ID, children: ['proj1', 'proj2'], isFavorite: true }),
    makeFolder({ id: 'proj1', name: 'NovaOS', parentId: PROJECTS_ID, children: ['pf1', 'pf2', 'pf3'] }),
    makeFile({ id: 'pf1', name: 'README.md', parentId: 'proj1', size: 12_000 }),
    makeFile({ id: 'pf2', name: 'package.json', parentId: 'proj1', size: 3_400, mimeType: 'application/json' }),
    makeFile({ id: 'pf3', name: 'index.ts', parentId: 'proj1', size: 8_800, mimeType: 'application/typescript' }),
    makeFolder({ id: 'proj2', name: 'Design Assets', parentId: PROJECTS_ID, children: ['pf4'] }),
    makeFile({ id: 'pf4', name: 'Mockup.svg', parentId: 'proj2', size: 240_000 }),

    // Downloads
    makeFolder({ id: DOWNLOADS_ID, name: 'Downloads', parentId: ROOT_ID, children: ['dl1', 'dl2', 'dl3', 'dl4'], isFavorite: true }),
    makeFile({ id: 'dl1', name: 'archive.zip', parentId: DOWNLOADS_ID, size: 48_000_000 }),
    makeFile({ id: 'dl2', name: 'installer.dmg', parentId: DOWNLOADS_ID, size: 220_000_000 }),
    makeFile({ id: 'dl3', name: 'data-export.csv', parentId: DOWNLOADS_ID, size: 2_800_000 }),
    makeFile({ id: 'dl4', name: 'ebook.pdf', parentId: DOWNLOADS_ID, size: 8_400_000 }),

    // Applications
    makeFolder({ id: 'applications', name: 'Applications', parentId: ROOT_ID, children: ['app1', 'app2'] }),
    makeFile({ id: 'app1', name: 'Settings.app', parentId: 'applications', size: 0, mimeType: 'application/octet-stream' }),
    makeFile({ id: 'app2', name: 'Files.app', parentId: 'applications', size: 0, mimeType: 'application/octet-stream' }),
  ];

  return Object.fromEntries(nodes.map(n => [n.id, n]));
}

// ─── VFS Utilities ───────────────────────────────────────────────────────────

export function getPath(nodes: Record<string, VFSNode>, nodeId: string): VFSNode[] {
  const path: VFSNode[] = [];
  let current: VFSNode | undefined = nodes[nodeId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return path;
}

export function getChildren(nodes: Record<string, VFSNode>, folderId: string): VFSNode[] {
  const folder = nodes[folderId];
  if (!folder || folder.type !== 'folder') return [];
  return folder.children.map(id => nodes[id]).filter(Boolean);
}

export function getFolderSize(nodes: Record<string, VFSNode>, folderId: string): number {
  const folder = nodes[folderId];
  if (!folder) return 0;
  if (folder.type === 'file') return folder.size;
  return folder.children.reduce((acc, id) => acc + getFolderSize(nodes, id), 0);
}

export function searchNodes(nodes: Record<string, VFSNode>, query: string): VFSNode[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return Object.values(nodes).filter(n => n.name.toLowerCase().includes(q));
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export function isDescendant(nodes: Record<string, VFSNode>, ancestorId: string, nodeId: string): boolean {
  let current = nodes[nodeId];
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = nodes[current.parentId];
  }
  return false;
}
