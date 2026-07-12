import {describe, expect, test} from "bun:test"

import {parseContactInviteFragment} from "./contact_invite_landing.js"

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
