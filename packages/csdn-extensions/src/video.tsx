import type { EditorExtension, ExtensionContext } from '@geekx/toolbar'
import { Video } from 'lucide-react'
import { escapeHtml, httpUrl } from './embed-html'
import { reportFailure } from './form'

const ICON = 16
const FILE_CLASS = 'ex-csdn-ext-file'

function videoHtml(payload: unknown): string {
  const data = payload as { url?: unknown; cover?: unknown }
  const url = httpUrl(data.url)
  if (!url) return '<div class="ex-csdn-ext-card"></div>'
  const cover = httpUrl(data.cover)
  const poster = cover ? ` poster="${escapeHtml(cover)}"` : ''
  return `<video src="${escapeHtml(url)}"${poster} controls></video>`
}

async function uploadVideoFile(ctx: ExtensionContext, file: File): Promise<void> {
  const uploadVideo = ctx.adapters.uploadVideo
  if (!uploadVideo) return
  try {
    const result = await uploadVideo(file)
    const url = httpUrl(result.url)
    if (!url) {
      ctx.notify(ctx.locale.csdnExt.videoBadUrl, 'error')
      return
    }
    if (result.cover !== undefined) {
      const cover = httpUrl(result.cover)
      if (!cover) {
        ctx.notify(ctx.locale.csdnExt.videoBadUrl, 'error')
        return
      }
      ctx.insertEmbed('video', { url, cover })
      return
    }
    ctx.insertEmbed('video', { url })
  } catch (error) {
    reportFailure(ctx, ctx.locale.csdnExt.videoFailed, error)
  }
}

export const csdnVideoExtension: EditorExtension = {
  name: 'csdn:video',
  requires: ['uploadVideo'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:video',
      title: (m) => m.toolbar.video,
      label: (m) => m.toolbar.video,
      icon: <Video size={ICON} />,
      group: 'csdn',
      order: 20,
      run(ctx) {
        document.querySelectorAll(`input.${FILE_CLASS}`).forEach((node) => node.remove())
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'video/*'
        input.className = FILE_CLASS
        input.hidden = true
        input.addEventListener('change', () => {
          const chosen = input.files?.[0]
          input.remove()
          if (chosen) void uploadVideoFile(ctx, chosen)
        })
        document.body.append(input)
        input.click()
      },
    },
  ],
  embeds: [{ type: 'video', renderHtml: videoHtml }],
}
