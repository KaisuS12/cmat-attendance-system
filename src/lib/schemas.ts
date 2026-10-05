import { z } from "zod";
import { dayWindowProblem } from "@/lib/windows";

export { dayWindowProblem };

const isoDateTime = z.iso.datetime({ offset: true, message: "Must be a valid date and time." });

export const daySchema = z
  .object({
    dayDate: z.iso.date({ message: "Must be a valid date." }),
    signInStart: isoDateTime,
    signInEnd: isoDateTime,
    signOutStart: isoDateTime,
    signOutEnd: isoDateTime,
  })
  .superRefine((day, ctx) => {
    const problem = dayWindowProblem(day);
    if (problem) ctx.addIssue({ code: "custom", path: [problem.field], message: problem.message });
  });

export const dayPatchSchema = z.object({
  signInStart: isoDateTime.optional(),
  signInEnd: isoDateTime.optional(),
  signOutStart: isoDateTime.optional(),
  signOutEnd: isoDateTime.optional(),
});
