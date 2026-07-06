'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { req, API } from '../admin-tabs';
import { ImageIcon, Trash2, Upload, Loader2, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface UploadFile {
  name: string;
  size: number;
  mtime: number;
}

export default function GalleryTab() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { ok, data } = await req<{ files: UploadFile[] }>('GET', `${API}/admin/uploads`);
    if (ok) { setFiles(data.files || []); setError(''); }
    else { setError('无法加载图库'); }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        toast.success('上传成功');
        load();
      } else {
        toast.error('上传失败');
      }
    } catch { toast.error('上传失败'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (name: string) => {
    const { ok } = await req('DELETE', `${API}/admin/uploads/${encodeURIComponent(name)}`);
    if (ok) { toast.success('已删除'); load(); }
    else { toast.error('删除失败'); }
  };

  const copyUrl = (name: string) => {
    const url = `${window.location.origin}/uploads/${name}`;
    navigator.clipboard.writeText(url);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <ImageIcon className="size-4 text-muted-foreground" />
          图库（{files.length} 张）
        </h3>
        <div className="flex gap-2 items-center">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <><Loader2 className="size-3.5 animate-spin" /> 上传中</> : <><Upload className="size-3.5" /> 上传</>}
          </Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/25 p-2.5 text-sm text-destructive">{error}</div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/60 text-sm">
          <ImageIcon className="size-8 mx-auto mb-2 opacity-40" />
          暂无上传的图片
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {files.map(f => (
            <div key={f.name} className="rounded-xl border border-border bg-card overflow-hidden group">
              <div className="aspect-square bg-muted/30 flex items-center justify-center p-3 relative">
                <img src={`/uploads/${f.name}`} alt={f.name}
                  className="max-w-full max-h-full object-contain"
                  onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button variant="outline" size="sm" className="bg-white/90 hover:bg-white" onClick={() => copyUrl(f.name)}>
                    {copied === f.name ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(f.name)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                  <a href={`/uploads/${f.name}`} target="_blank" className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/90 hover:bg-white text-foreground">
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>
              <div className="p-2 text-[10px] text-muted-foreground truncate" title={f.name}>
                {f.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
