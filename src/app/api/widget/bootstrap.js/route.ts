import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();

  const js = `(function () {
  try {
    var currentScript = document.currentScript;
    var dataToken =
      currentScript && currentScript.getAttribute
        ? currentScript.getAttribute('data-claw-token') || ''
        : '';

    var token = String(window.clawWidgetToken || dataToken || '${token}')
      .trim();

    if (!token) {
      console.warn('[LeadClaw widget] Missing widget token.');
      return;
    }

    if (document.getElementById('claw-widget-root')) return;

    var root = document.createElement('div');
    root.id = 'claw-widget-root';
    root.style.position = 'fixed';
    root.style.right = '20px';
    root.style.bottom = '20px';
    root.style.zIndex = '2147483000';
    root.style.fontFamily = 'Arial, sans-serif';

    var panelOpen = false;

    var panel = document.createElement('div');
    panel.style.width = '320px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.background = '#ffffff';
    panel.style.border = '1px solid #e2e8f0';
    panel.style.borderRadius = '16px';
    panel.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)';
    panel.style.marginBottom = '12px';
    panel.style.overflow = 'hidden';
    panel.style.display = 'none';

    var header = document.createElement('div');
    header.style.background = '#0f766e';
    header.style.color = '#ffffff';
    header.style.padding = '14px 16px';
    header.style.fontSize = '14px';
    header.style.fontWeight = '700';
    header.textContent = 'LeadClaw Assistant';

    var body = document.createElement('div');
    body.style.padding = '16px';
    body.style.color = '#0f172a';
    body.style.fontSize = '14px';
    body.style.lineHeight = '1.5';

    var title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    title.textContent = 'Submit an enquiry';

    var form = document.createElement('form');
    form.onsubmit = function (e) {
      e.preventDefault();
      var name = (nameField.value || '').trim();
      var email = (emailField.value || '').trim();
      if (!name || !email) {
        alert('Please enter both name and email.');
        return;
      }

      // Submit lead to the backend
      fetch('/api/widget/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, token })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            alert('Thank you! Your enquiry has been submitted.');
            nameField.value = '';
            emailField.value = '';
          } else {
            alert('Something went wrong. Please try again later.');
          }
        })
        .catch(() => {
          alert('Error submitting the enquiry. Please try again.');
        });
    };

    var nameField = document.createElement('input');
    nameField.placeholder = 'Your name';
    nameField.style.marginBottom = '10px';
    nameField.style.padding = '8px';
    nameField.style.width = '100%';
    nameField.style.border = '1px solid #e2e8f0';
    nameField.style.borderRadius = '8px';
    nameField.style.fontSize = '14px';

    var emailField = document.createElement('input');
    emailField.placeholder = 'Your email';
    emailField.type = 'email';
    emailField.style.marginBottom = '10px';
    emailField.style.padding = '8px';
    emailField.style.width = '100%';
    emailField.style.border = '1px solid #e2e8f0';
    emailField.style.borderRadius = '8px';
    emailField.style.fontSize = '14px';

    var submitButton = document.createElement('button');
    submitButton.textContent = 'Submit Enquiry';
    submitButton.type = 'submit';
    submitButton.style.background = '#0f766e';
    submitButton.style.color = '#fff';
    submitButton.style.border = '0';
    submitButton.style.borderRadius = '8px';
    submitButton.style.padding = '10px';
    submitButton.style.fontSize = '14px';
    submitButton.style.cursor = 'pointer';

    form.appendChild(nameField);
    form.appendChild(emailField);
    form.appendChild(submitButton);

    body.appendChild(title);
    body.appendChild(form);

    panel.appendChild(header);
    panel.appendChild(body);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open LeadClaw assistant');
    btn.textContent = 'Chat with us';
    btn.style.background = '#0f766e';
    btn.style.color = '#ffffff';
    btn.style.border = '0';
    btn.style.borderRadius = '999px';
    btn.style.padding = '12px 16px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';
    btn.style.fontWeight = '600';
    btn.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.35)';

    btn.onclick = function () {
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? 'block' : 'none';
    };

    root.appendChild(panel);
    root.appendChild(btn);

    function mount() {
      if (document.body) {
        document.body.appendChild(root);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }
  } catch (e) {
    console.error('[LeadClaw widget] Bootstrap failed.', e);
  }
})();`;

  return new NextResponse(js, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
