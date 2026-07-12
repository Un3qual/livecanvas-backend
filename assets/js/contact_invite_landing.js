export function parseContactInviteFragment(fragment) {
  if (typeof fragment !== "string" || fragment === "") return null

  const encodedFragment = fragment.startsWith("#") ? fragment.slice(1) : fragment

  try {
    const pairs = encodedFragment.split("&").map((pair) => {
      const separatorIndex = pair.indexOf("=")
      if (separatorIndex < 0) throw new URIError("malformed fragment pair")

      const decode = (value) => decodeURIComponent(value.replaceAll("+", " "))
      return [decode(pair.slice(0, separatorIndex)), decode(pair.slice(separatorIndex + 1))]
    })

    const tokens = pairs.filter(([key]) => key === "token").map(([, value]) => value)
    if (tokens.length !== 1 || tokens[0].trim() === "") return null

    return tokens[0]
  } catch (_error) {
    return null
  }
}

export function initializeContactInviteLanding(
  windowObject = globalThis.window,
  documentObject = globalThis.document,
) {
  if (!windowObject || !documentObject) return

  const landing = documentObject.querySelector("[data-contact-invite-landing]")
  if (!landing) return

  const token = parseContactInviteFragment(windowObject.location.hash)
  const action = landing.querySelector("[data-contact-invite-action]")
  const state = landing.querySelector("[data-contact-invite-state]")

  if (token && action && state) {
    action.href = `livecanvas-mobile://invite?token=${encodeURIComponent(token)}`
    action.hidden = false
    state.textContent = "Your invitation is ready."
  } else if (action && state) {
    action.removeAttribute("href")
    action.hidden = true
    state.textContent = "This invite is invalid or expired."
  }

  windowObject.history.replaceState(
    null,
    "",
    `${windowObject.location.pathname}${windowObject.location.search}`,
  )
}
