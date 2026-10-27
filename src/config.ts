/**
 * Configurações do Pocards que o dono do app preenche.
 * (Ficam visíveis no código do site; não coloque senhas aqui.)
 */
export const APP_VERSION = '0.1.0'

export const FEEDBACK = {
  /**
   * E-mail que recebe os feedbacks. Usado no modo "abrir o app de e-mail"
   * e como alternativa se o envio direto falhar.
   * Exemplo: 'pocards.app@gmail.com'
   */
  email: 'suportepocards@gmail.com',

  /**
   * Chave de acesso do Web3Forms (grátis, 250 envios/mês): permite enviar o
   * feedback sem sair do app. Crie em https://web3forms.com com o e-mail acima.
   * Deixe vazio para usar só o modo e-mail.
   */
  web3formsKey: '9c257bd3-42c5-4673-93e1-609e0bdc3622',
}

/**
 * Servidor online (Supabase, plano grátis) usado no ranking mundial do chefe:
 * os 3 primeiros jogadores a derrotar o Rei Goblin ganham ouro, prata e bronze.
 * Pegue os dois valores em Supabase › Project Settings › API (ou "Connect").
 * A chave pública (anon/publishable) pode ficar no código: quem protege os
 * dados são as regras do banco (arquivo supabase/medalhas.sql).
 * Deixe vazio enquanto não tiver o servidor: o app mostra "ranking em breve".
 */
export const ONLINE = {
  /** Ex.: 'https://abcdefgh.supabase.co' */
  supabaseUrl: 'https://nmltejkosvpvsbbanhdt.supabase.co',
  /** Chave pública: "anon public" (eyJ...) ou "publishable" (sb_publishable_...). */
  supabaseKey: 'sb_publishable_Lr91un7zFkTl8_4S_fNVyw_WrkGYPhd',
  /**
   * Chave do site do Cloudflare Turnstile (CAPTCHA contra robôs no pódio).
   * Pública, pode ficar no código. A chave SECRETA vai só no painel do Supabase
   * (Authentication › Bot and Abuse Protection). Vazio = sem CAPTCHA.
   */
  captchaSiteKey: '',
}
