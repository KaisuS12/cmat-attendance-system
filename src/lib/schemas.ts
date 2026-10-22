import { z } from "zod";
import { dayWindowProblem } from "@/lib/windows";

export { dayWindowProblem };

const isoDateTime = z.iso.datetime({ offset: true, message: "Must be a valid date and time." });

// A saved venue, or a new one picked on the map.
export const venueSchema = z.union([
  z.object({ venueId: z.uuid() }),
  z.object({
    name: z.string().trim().min(1, "Venue name is required."),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(20, "Radius must be at least 20 m.").max(2000).default(150),
  }),
]);
export type VenueInput = z.infer<typeof venueSchema>;

export const daySchema = z
  .object({
    dayDate: z.iso.date({ message: "Must be a valid date." }),
    // Optional: a name for the day ("Opening", "Field Day") and a venue
    // different from the event's.
    title: z.string().trim().max(80, "Day title is too long.").optional(),
    venue: venueSchema.optional(),
    // Several sessions can share a date ("Morning", "Afternoon").
    session: z.string().trim().max(30, "Session name is too long.").default(""),
    // false = sign-in only: signing in counts as present.
    signOutRequired: z.boolean().default(true),
    signInStart: isoDateTime,
    signInEnd: isoDateTime,
    signOutStart: isoDateTime,
    signOutEnd: isoDateTime,
  })
  .superRefine((day, ctx) => {
    const problem = dayWindowProblem(day, day.signOutRequired);
    if (problem) ctx.addIssue({ code: "custom", path: [problem.field], message: problem.message });
  })
  // Sign-in only: the unused sign-out window is pinned to the end of sign-in,
  // so "is this session over?" checks keep working.
  .transform((day) =>
    day.signOutRequired ? day : { ...day, signOutStart: day.signInEnd, signOutEnd: day.signInEnd }
  );

export const dayPatchSchema = z.object({
  signInStart: isoDateTime.optional(),
  signInEnd: isoDateTime.optional(),
  signOutStart: isoDateTime.optional(),
  signOutEnd: isoDateTime.optional(),
});
