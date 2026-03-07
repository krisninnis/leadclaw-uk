import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  const appOrigin = url.origin;

  const js = `(function () {
  try {
    var currentScript = document.currentScript;
    var dataToken =
      currentScript && currentScript.getAttribute
        ? currentScript.getAttribute('data-claw-token') || ''
        : '';

    var submitUrl = '${appOrigin}/api/widget/submit';

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
    root.style.fontFamily = 'Inter, Arial, Helvetica, sans-serif';

    var panelOpen = false;
    var submitting = false;

    var panel = document.createElement('div');
    panel.style.width = '360px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.background = '#ffffff';
    panel.style.border = '1px solid #e2e8f0';
    panel.style.borderRadius = '18px';
    panel.style.boxShadow = '0 20px 50px rgba(15, 23, 42, 0.18)';
    panel.style.marginBottom = '12px';
    panel.style.overflow = 'hidden';
    panel.style.display = 'none';

    var header = document.createElement('div');
    header.style.background = '#0f766e';
    header.style.color = '#ffffff';
    header.style.padding = '14px 16px';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';

    var headerTextWrap = document.createElement('div');

    var headerTitle = document.createElement('div');
    headerTitle.style.fontSize = '14px';
    headerTitle.style.fontWeight = '700';
    headerTitle.textContent = 'LeadClaw Assistant';

    var headerSubtitle = document.createElement('div');
    headerSubtitle.style.fontSize = '12px';
    headerSubtitle.style.opacity = '0.9';
    headerSubtitle.style.marginTop = '2px';
    headerSubtitle.textContent = 'We usually reply quickly.';

    headerTextWrap.appendChild(headerTitle);
    headerTextWrap.appendChild(headerSubtitle);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close widget');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = '#ffffff';
    closeBtn.style.border = '0';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0 0 2px 8px';
    closeBtn.onclick = function () {
      panelOpen = false;
      panel.style.display = 'none';
    };

    header.appendChild(headerTextWrap);
    header.appendChild(closeBtn);

    var body = document.createElement('div');
    body.style.padding = '16px';
    body.style.color = '#0f172a';
    body.style.fontSize = '14px';
    body.style.lineHeight = '1.5';

    var title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '6px';
    title.textContent = 'Request a callback';

    var intro = document.createElement('div');
    intro.style.fontSize = '13px';
    intro.style.color = '#475569';
    intro.style.marginBottom = '12px';
    intro.textContent =
      'Share your details and the clinic team can follow up with you.';

    var form = document.createElement('form');

    var nameField = document.createElement('input');
    nameField.placeholder = 'Your name';
    nameField.autocomplete = 'name';
    nameField.style.marginBottom = '10px';
    nameField.style.padding = '10px 12px';
    nameField.style.width = '100%';
    nameField.style.boxSizing = 'border-box';
    nameField.style.border = '1px solid #cbd5e1';
    nameField.style.borderRadius = '10px';
    nameField.style.fontSize = '14px';
    nameField.style.outline = 'none';

    var emailField = document.createElement('input');
    emailField.placeholder = 'Your email';
    emailField.type = 'email';
    emailField.autocomplete = 'email';
    emailField.style.marginBottom = '10px';
    emailField.style.padding = '10px 12px';
    emailField.style.width = '100%';
    emailField.style.boxSizing = 'border-box';
    emailField.style.border = '1px solid #cbd5e1';
    emailField.style.borderRadius = '10px';
    emailField.style.fontSize = '14px';
    emailField.style.outline = 'none';

    var phoneField = document.createElement('input');
    phoneField.placeholder = 'Phone (optional)';
    phoneField.type = 'tel';
    phoneField.autocomplete = 'tel';
    phoneField.style.marginBottom = '10px';
    phoneField.style.padding = '10px 12px';
    phoneField.style.width = '100%';
    phoneField.style.boxSizing = 'border-box';
    phoneField.style.border = '1px solid #cbd5e1';
    phoneField.style.borderRadius = '10px';
    phoneField.style.fontSize = '14px';
    phoneField.style.outline = 'none';

    var status = document.createElement('div');
    status.style.minHeight = '18px';
    status.style.fontSize = '12px';
    status.style.marginBottom = '10px';
    status.style.color = '#475569';

    var submitButton = document.createElement('button');
    submitButton.textContent = 'Send enquiry';
    submitButton.type = 'submit';
    submitButton.style.background = '#0f766e';
    submitButton.style.color = '#fff';
    submitButton.style.border = '0';
    submitButton.style.borderRadius = '10px';
    submitButton.style.padding = '11px 14px';
    submitButton.style.fontSize = '14px';
    submitButton.style.fontWeight = '600';
    submitButton.style.cursor = 'pointer';
    submitButton.style.width = '100%';

    function setStatus(message, color) {
      status.textContent = message || '';
      status.style.color = color || '#475569';
    }

    function setSubmitting(value) {
      submitting = value;
      submitButton.disabled = value;
      submitButton.style.opacity = value ? '0.7' : '1';
      submitButton.style.cursor = value ? 'not-allowed' : 'pointer';
      submitButton.textContent = value ? 'Sending...' : 'Send enquiry';
    }

    form.onsubmit = function (e) {
      e.preventDefault();
      if (submitting) return;

      var name = (nameField.value || '').trim();
      var email = (emailField.value || '').trim();
      var phone = (phoneField.value || '').trim();

      if (!name || !email) {
        setStatus('Please enter both name and email.', '#b91c1c');
        return;
      }

      setStatus('');
      setSubmitting(true);

      fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: phone || undefined,
          token: token
        })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            nameField.value = '';
            emailField.value = '';
            phoneField.value = '';
            setStatus('Thanks — your enquiry has been sent.', '#166534');
          } else {
            setStatus('Something went wrong. Please try again later.', '#b91c1c');
          }
        })
        .catch(function () {
          setStatus('Error submitting the enquiry. Please try again.', '#b91c1c');
        })
        .finally(function () {
          setSubmitting(false);
        });
    };

    form.appendChild(nameField);
    form.appendChild(emailField);
    form.appendChild(phoneField);
    form.appendChild(status);
    form.appendChild(submitButton);

    body.appendChild(title);
    body.appendChild(intro);
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
      "cache-control": "no-store, max-age=0",
    },
  });
}
