export function parseMagicLinkFragment(fragment) {
  if (typeof fragment !== "string" || fragment === "") return null

  const encodedFragment = fragment.startsWith("#") ? fragment.slice(1) : fragment
  const pairs = encodedFragment.split("&")

  if (pairs.length !== 1) return null

  const separatorIndex = pairs[0].indexOf("=")
  if (separatorIndex < 0) return null

  try {
    const decode = (value) => decodeURIComponent(value.replaceAll("+", " "))
    const key = decode(pairs[0].slice(0, separatorIndex))
    const token = decode(pairs[0].slice(separatorIndex + 1))

    return key === "token" && token.trim() !== "" ? token : null
  } catch (_error) {
    return null
  }
}

export function purposeFromMagicLinkPath(pathname) {
  if (pathname === "/auth/magic-link/sign-in") return "sign-in"
  if (pathname === "/auth/magic-link/sign-up") return "sign-up"
  return null
}

export function initializeMagicLinkLanding(
  windowObject = globalThis.window,
  documentObject = globalThis.document,
) {
  if (!windowObject || !documentObject) return

  const landing = documentObject.querySelector("[data-magic-link-landing]")
  if (!landing) return

  const token = parseMagicLinkFragment(windowObject.location.hash)
  const purpose = purposeFromMagicLinkPath(windowObject.location.pathname)
  const action = landing.querySelector("[data-magic-link-action]")
  const state = landing.querySelector("[data-magic-link-state]")

  if (token && purpose && action && state) {
    action.href =
      `livecanvas-mobile://magic-link/${purpose}?token=${encodeURIComponent(token)}`
    action.hidden = false
    state.textContent = "Your email link is ready."
  } else if (action && state) {
    action.removeAttribute("href")
    action.hidden = true
    state.textContent = "This email link is invalid or expired."
  }

  windowObject.history.replaceState(
    null,
    "",
    `${windowObject.location.pathname}${windowObject.location.search}`,
  )
}
