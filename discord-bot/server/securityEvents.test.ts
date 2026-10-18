import { afterEach, describe, expect, it } from "vitest";
import {
  MemberAuthError,
  acknowledgeSecurityEvent,
  listSecurityEvents,
  recordSecurityEvent,
  setMemberAuthPoolForTesting,
  type PublicMember,
} from "./memberAuth";

const member: PublicMember = {
  id: "member-1",
  username: "security_user",
  nickname: "보안 회원",
  discordNickname: "security",
  gameNickname: "security",
  role: "member",
  status: "approved",
  approvedAt: "2026-08-19T00:00:00.000Z",
  lastActivityAt: "2026-08-19T00:00:00.000Z",
  createdAt: "2026-08-19T00:00:00.000Z",
};

function createSecurityEventPool() {
  const events: Array<Record<string, unknown>> = [];
  return {
    async execute(sql: string, values: unknown[] = []) {
      if (sql.includes("INSERT INTO security_events")) {
        events.push({
          id: values[0], memberId: values[1], memberUsername: values[2], memberNickname: values[3],
          eventType: values[4], path: values[5], createdAt: new Date(), acknowledgedAt: null, acknowledgedBy: null,
        });
        return [[], []];
      }
      if (sql.includes("UPDATE security_events SET acknowledged_at")) {
        const event = events.find((candidate) => candidate.id === values[1]);
        if (!event) return [{ affectedRows: 0 }, []];
        if (!event.acknowledgedAt) {
          event.acknowledgedAt = new Date();
          event.acknowledgedBy = values[0];
        }
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unhandled execute: ${sql}`);
    },
    async query(sql: string, values: unknown[] = []) {
      if (sql.includes("FROM security_events WHERE id")) {
        return [events.filter((event) => event.id === values[0]), []];
      }
      if (sql.includes("FROM security_events")) {
        return [[...events].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)), []];
      }
      throw new Error(`Unhandled query: ${sql}`);
    },
  };
}

describe("security event storage", () => {
  afterEach(() => setMemberAuthPoolForTesting(undefined));

  it("records the logged-in member identity and allows an administrator to acknowledge the event", async () => {
    setMemberAuthPoolForTesting(createSecurityEventPool() as never);

    const created = await recordSecurityEvent(member, { eventType: "print_requested", path: "/tree" });
    expect(created).toMatchObject({
      memberId: member.id,
      memberUsername: "security_user",
      memberNickname: "보안 회원",
      eventType: "print_requested",
      path: "/tree",
      acknowledgedAt: null,
    });
    expect(await listSecurityEvents()).toEqual([expect.objectContaining({ id: created.id, eventType: "print_requested" })]);

    const acknowledged = await acknowledgeSecurityEvent(created.id, "admin-1");
    expect(acknowledged.acknowledgedBy).toBe("admin-1");
    expect(acknowledged.acknowledgedAt).toBeTruthy();
  });

  it("rejects arbitrary event names instead of allowing a client to store unrecognized records", async () => {
    setMemberAuthPoolForTesting(createSecurityEventPool() as never);
    await expect(recordSecurityEvent(member, { eventType: "made_up_event", path: "/" })).rejects.toMatchObject<MemberAuthError>({ code: "INVALID_INPUT" });
  });
});
