// Envio de e-mail via API REST do Resend (sem SDK — só fetch, pra não somar dependência).
// Free tier do Resend: remetente compartilhado `onboarding@resend.dev` só entrega para o
// e-mail dono da conta. Para enviar a qualquer destinatário, verifique um domínio e troque
// EMAIL_FROM. Docs: https://resend.com/docs/api-reference/emails/send-email

export interface SendEmailInput {
  to:       string
  subject:  string
  html:     string
  text?:    string
}

export class EmailNotConfiguredError extends Error {
  constructor() { super('RESEND_API_KEY não configurada'); this.name = 'EmailNotConfiguredError' }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

// Envia um e-mail. Lança EmailNotConfiguredError se faltar a chave, e Error com a mensagem
// da API se o Resend recusar (chamador decide se loga/ignora).
export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<string> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new EmailNotConfiguredError()
  const from = process.env.EMAIL_FROM || 'AstroLog <onboarding@resend.dev>'

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from, to, subject, html, ...(text ? { text } : {}) }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data: any = await res.json().catch(() => ({}))
  return data?.id ?? ''
}
