import {describe, expect, test} from "bun:test"

import {
  initializeContactInviteLanding,
  parseContactInviteFragment,
} from "./contact_invite_landing.js"

describe("parseContactInviteFragment", () => {
  test("returns one decoded nonblank token", () => {
    expect(parseContactInviteFragment("#token=invite%2Esecret%2D_value")).toBe(
      "invite.secret-_value",
    )
  })

  test("rejects a missing token", () => {
    expect(parseContactInviteFragment("")).toBeNull()
    expect(parseContactInviteFragment("#source=email")).toBeNull()
  })

  test("rejects duplicated token values", () => {
    expect(parseContactInviteFragment("#token=first&token=second")).toBeNull()
  })

  test("rejects blank and malformed token fragments", () => {
    expect(parseContactInviteFragment("#token=%20%20")).toBeNull()
    expect(parseContactInviteFragment("#token=bad%ZZvalue")).toBeNull()
    expect(parseContactInviteFragment("#token")).toBeNull()
  })
})

describe("initializeContactInviteLanding", () => {
  test("sets the encoded mobile action and clears the browser fragment", () => {
    const {action, historyCalls, state, windowObject, documentObject} = landingFixture(
      "#token=invite%20secret%2Fvalue",
    )

    initializeContactInviteLanding(windowObject, documentObject)

    expect(action.href).toBe("livecanvas-mobile://invite?token=invite%20secret%2Fvalue")
    expect(action.hidden).toBeFalse()
    expect(state.textContent).toBe("Your invitation is ready.")
    expect(historyCalls).toEqual([[null, "", "/invites?source=email"]])
  })

  test("restores the generic invalid state and clears malformed fragments", () => {
    const {action, historyCalls, state, windowObject, documentObject} = landingFixture(
      "#token=first&token=second",
    )

    action.href = "livecanvas-mobile://invite?token=stale"
    action.hidden = false
    state.textContent = "Your invitation is ready."

    initializeContactInviteLanding(windowObject, documentObject)

    expect(action.href).toBeUndefined()
    expect(action.hidden).toBeTrue()
    expect(state.textContent).toBe("This invite is invalid or expired.")
    expect(historyCalls).toEqual([[null, "", "/invites?source=email"]])
  })
})

function landingFixture(hash) {
  const action = {
    hidden: true,
    removeAttribute(name) {
      if (name === "href") this.href = undefined
    },
  }
  const state = {textContent: "This invite is invalid or expired."}
  const landing = {
    querySelector(selector) {
      if (selector === "[data-contact-invite-action]") return action
      if (selector === "[data-contact-invite-state]") return state
      return null
    },
  }
  const historyCalls = []
  const windowObject = {
    location: {hash, pathname: "/invites", search: "?source=email"},
    history: {
      replaceState(...args) {
        historyCalls.push(args)
      },
    },
  }
  const documentObject = {
    querySelector(selector) {
      return selector === "[data-contact-invite-landing]" ? landing : null
    },
  }

  return {action, documentObject, historyCalls, state, windowObject}
}
