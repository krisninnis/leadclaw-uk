import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''

  const js = `(function(){\n  try {\n    var token = (window.clawWidgetToken || '${token}').trim();\n    if(!token) return;\n    if(document.getElementById('claw-widget-root')) return;\n\n    var root = document.createElement('div');\n    root.id='claw-widget-root';\n    root.style.position='fixed';\n    root.style.right='20px';\n    root.style.bottom='20px';\n    root.style.zIndex='2147483000';\n\n    var btn = document.createElement('button');\n    btn.innerText='Chat with us';\n    btn.style.background='#0f766e';\n    btn.style.color='#fff';\n    btn.style.border='0';\n    btn.style.borderRadius='999px';\n    btn.style.padding='12px 16px';\n    btn.style.cursor='pointer';\n    btn.style.fontFamily='Arial, sans-serif';\n    btn.onclick=function(){\n      alert('Widget token: '+token+'\\n(Replace with full chat UI endpoint when ready)');\n    };\n\n    root.appendChild(btn);\n    document.body.appendChild(root);\n  } catch (e) {}\n})();`

  return new NextResponse(js, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}
