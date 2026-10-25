// Aplica o tema salvo antes de desenhar a tela (evita "piscar" no tema errado).
// Fica num arquivo próprio (e não dentro do index.html) para a política de
// segurança do site poder proibir qualquer script escrito dentro da página.
try {
  var saved = JSON.parse(localStorage.getItem('pocards-settings') || '{}') || {}
  var theme = saved.theme === 'light' || saved.theme === 'system' ? saved.theme : 'dark'
  if (theme === 'system') theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
} catch (e) {
  document.documentElement.dataset.theme = 'dark'
}
