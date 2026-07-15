import assert from "node:assert/strict"
import {describe, test} from "node:test"

import {
  initializeMagicLinkLanding,
  parseMagicLinkFragment,
  purposeFromMagicLinkPath,
} from "./magic_link_landing.js"

describe("parseMagicLinkFragment", () => {
  test("returns one decoded nonblank token", () => {
    assert.equal(
      parseMagicLinkFragment("#token=magic%2Esecret%2D_value"),
      "magic.secret-_value",
    )
  })

  test("rejects missing, duplicate, extra, blank, and malformed values", () => {
    for (const fragment of [
      "",
      "#source=email",
      "#token=first&token=second",
      "#token=one&source=email",
      "#token=%20%20",
      "#token=bad%ZZvalue",
      "#token",
    ]) {
      assert.equal(parseMagicLinkFragment(fragment), null)
    }
  })
})

describe("purposeFromMagicLinkPath", () => {
  test("accepts only the two exact landing paths", () => {
    assert.equal(purposeFromMagicLinkPath("/auth/magic-link/sign-in"), "sign-in")
    assert.equal(purposeFromMagicLinkPath("/auth/magic-link/sign-up"), "sign-up")

    for (const path of [
      "/auth/magic-link",
      "/auth/magic-link/sign-in/",
      "/auth/magic-link/%73ign-in",
      "/auth/magic-link/other",
    ]) {
      assert.equal(purposeFromMagicLinkPath(path), null)
    }
  })
})

describe("initializeMagicLinkLanding", () => {
  test("sets the purpose-specific encoded mobile action and clears the fragment", () => {
    const fixture = landingFixture(
      "/auth/magic-link/sign-up",
      "#token=magic%20secret%2Fvalue",
    )

    initializeMagicLinkLanding(fixture.windowObject, fixture.documentObject)

    assert.equal(
      fixture.action.href,
      "livecanvas-mobile://magic-link/sign-up?token=magic%20secret%2Fvalue",
    )
    assert.equal(fixture.action.hidden, false)
    assert.equal(fixture.state.textContent, "Your email link is ready.")
    assert.deepEqual(fixture.historyCalls, [
      [null, "", "/auth/magic-link/sign-up?source=email"],
    ])
  })

  test("restores generic invalid state for a malformed fragment or path", () => {
    for (const [path, fragment] of [
      ["/auth/magic-link/sign-in", "#token=first&token=second"],
      ["/auth/magic-link/other", "#token=secret"],
    ]) {
      const fixture = landingFixture(path, fragment)
      fixture.action.href = "livecanvas-mobile://magic-link/sign-in?token=stale"
      fixture.action.hidden = false
      fixture.state.textContent = "Your email link is ready."

      initializeMagicLinkLanding(fixture.windowObject, fixture.documentObject)

      assert.equal(typeof fixture.action.href, "undefined")
      assert.equal(fixture.action.hidden, true)
      assert.equal(fixture.state.textContent, "This email link is invalid or expired.")
      assert.deepEqual(fixture.historyCalls, [
        [null, "", `${path}?source=email`],
      ])
    }
  })
})

function landingFixture(pathname, hash) {
  const action = {
    hidden: true,
    removeAttribute(name) {
      if (name === "href") this.href = undefined
    },
  }
  const state = {textContent: "This email link is invalid or expired."}
  const landing = {
    querySelector(selector) {
      if (selector === "[data-magic-link-action]") return action
      if (selector === "[data-magic-link-state]") return state
      return null
    },
  }
  const historyCalls = []
  const windowObject = {
    location: {hash, pathname, search: "?source=email"},
    history: {
      replaceState(...args) {
        historyCalls.push(args)
      },
    },
  }
  const documentObject = {
    querySelector(selector) {
      return selector === "[data-magic-link-landing]" ? landing : null
    },
  }

  return {action, documentObject, historyCalls, state, windowObject}
}
