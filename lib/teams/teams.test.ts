import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/notifications/service", () => ({
  userIdForEmail: async (email: string) => (email === "owner@hub.example" ? "owner" : null),
}));
vi.mock("@/lib/admin/data", () => ({ emailsById: async () => new Map([["u1", "ada@x.example"]]) }));

const teams = await import("@/lib/teams/service");
const { getUsage } = await import("@/lib/billing/service");

const staff = { id: "staff", email: "s@x", profile: { role: "super_admin" } } as never;
const future = "2099-01-31";

function reset() {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = ["u1", "u2", "u3", "owner"].map((id) => ({ id, plan: "free", credits: 0, full_name: id.toUpperCase(), last_seen_at: null }));
  db.teams = [];
  db.team_members = [];
  db.team_enquiries = [];
  db.audit_logs = [];
  db.subscriptions = [];
  db.startups = [{ id: "s1", owner_id: "u1", name: "Kora" }];
  db.assessments = [{ startup_id: "s1", overall_score: 72, created_at: "2026-10-01T00:00:00Z" }];
  db.simulations = [{ startup_id: "s1", status: "completed", mode: "full" }];
}

async function teamWithLink(seats = 2, ends_on = future) {
  const id = await teams.createTeam(staff, { name: "Lagos Accelerator", seats, ends_on, owner_email: "owner@hub.example" });
  return { id, token: await teams.newJoinLink(staff, id) };
}

describe("teams", () => {
  beforeEach(reset);

  it("lets founders join with the link and get Pro Plus", async () => {
    const { token } = await teamWithLink();
    expect(await teams.joinTeam("u1", token)).toEqual({ name: "Lagos Accelerator" });
    expect(await teams.joinTeam("u1", token)).toEqual({ name: "Lagos Accelerator" });
    expect(db.team_members).toHaveLength(1);
    expect((await getUsage("u1", null)).tier).toBe("pro_plus");
  });

  it("stops joining when seats run out, the link changes or the team has ended", async () => {
    const { id, token } = await teamWithLink(1);
    await teams.joinTeam("u1", token);
    await expect(teams.joinTeam("u2", token)).rejects.toThrow(/no seats left/);

    const fresh = await teams.newJoinLink(staff, id);
    await expect(teams.joinTeam("u2", token)).rejects.toThrow(/isn't valid/);
    expect(await teams.teamForJoinToken(fresh)).toMatchObject({ full: true });

    const ended = await teamWithLink(5, "2020-01-01");
    await expect(teams.joinTeam("u3", ended.token)).rejects.toThrow(/has ended/);
    expect(await teams.teamForJoinToken("not-a-token")).toBeNull();
  });

  it("keeps a founder in one team at a time, and lets them leave", async () => {
    const a = await teamWithLink();
    const b = await teamWithLink();
    await teams.joinTeam("u1", a.token);
    await expect(teams.joinTeam("u1", b.token)).rejects.toThrow(/another team/);
    await teams.leaveTeam("u1");
    expect((await getUsage("u1", null)).tier).toBe("free");
    await teams.joinTeam("u1", b.token);
  });

  it("needs the programme contact to have an account, and won't drop seats below members", async () => {
    await expect(
      teams.createTeam(staff, { name: "X", seats: 5, ends_on: future, owner_email: "nobody@x.example" }),
    ).rejects.toThrow(/No RaiseReady account/);
    const { id, token } = await teamWithLink(3);
    await teams.joinTeam("u1", token);
    await teams.joinTeam("u2", token);
    await expect(teams.updateTeam(staff, id, { name: "X", seats: 1, ends_on: future })).rejects.toThrow(/already has 2 members/);
  });

  it("shows the programme contact progress, not private work", async () => {
    const { id, token } = await teamWithLink();
    await teams.joinTeam("u1", token);
    expect((await teams.ownedTeam("owner"))?.id).toBe(id);
    const [row] = await teams.cohort(id);
    expect(row).toMatchObject({ name: "U1", startup: "Kora", score: 72, simulations: 1, email: null });
    expect(Object.keys(row).sort()).toEqual(["band", "email", "joinedAt", "lastSeen", "name", "score", "simulations", "startup", "userId"]);
    expect((await teams.cohort(id, true))[0].email).toBe("ada@x.example");
  });

  it("takes enquiries, a few per email a day", async () => {
    const input = { name: "Ada", organisation: "Hub", email: "Ada@Hub.example", cohort_size: 25 };
    for (let i = 0; i < 3; i++) await teams.submitEnquiry(input);
    await expect(teams.submitEnquiry(input)).rejects.toThrow(teams.TeamError);
    expect(db.team_enquiries).toHaveLength(3);
    expect(db.team_enquiries[0]).toMatchObject({ email: "ada@hub.example", status: undefined });
  });
});
