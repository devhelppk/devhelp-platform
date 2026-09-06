import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { safeCallback } from "@/components/auth/auth-form";
import { CourseCard, formatDuration } from "@/components/learning/course-card";
import { neighbours } from "@/components/learning/lesson-nav";
import { LessonList } from "@/components/learning/lesson-list";

describe("CourseCard", () => {
  it("renders track, level, duration, and progress", () => {
    render(
      <CourseCard
        slug="c"
        title="Course"
        summary="Summary"
        track="career"
        level="beginner"
        lessonCount={4}
        durationMinutes={95}
        progressPercent={50}
        status="active"
      />,
    );
    expect(screen.getByRole("link", { name: /Course/ })).toHaveAttribute(
      "href",
      "/courses/c",
    );
    expect(screen.getByText("Career")).toBeInTheDocument();
    expect(screen.getByText("4 lessons")).toBeInTheDocument();
    expect(screen.getByText("1 h 35 min")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
  });
});

describe("neighbours", () => {
  const lessons = [
    { slug: "a", title: "A" },
    { slug: "b", title: "B" },
    { slug: "c", title: "C" },
  ];
  it("finds prev and next across the flat list", () => {
    expect(neighbours(lessons, "a")).toEqual({ prev: null, next: lessons[1] });
    expect(neighbours(lessons, "b")).toEqual({
      prev: lessons[0],
      next: lessons[2],
    });
    expect(neighbours(lessons, "c")).toEqual({ prev: lessons[1], next: null });
    expect(neighbours(lessons, "zzz")).toEqual({ prev: null, next: null });
  });
});

describe("LessonList", () => {
  it("marks the current lesson and completed lessons", () => {
    render(
      <LessonList
        courseSlug="c"
        currentSlug="two"
        modules={[
          {
            slug: "m",
            title: "Module",
            lessons: [
              {
                slug: "one",
                title: "One",
                type: "article",
                durationMinutes: 5,
                isRequired: true,
                status: "completed",
              },
              {
                slug: "two",
                title: "Two",
                type: "video",
                durationMinutes: 10,
                isRequired: true,
                status: null,
              },
              {
                slug: "three",
                title: "Three",
                type: "link",
                durationMinutes: null,
                isRequired: false,
                status: null,
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Two/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByLabelText("Completed")).toBeInTheDocument();
    expect(screen.getByLabelText("Optional")).toBeInTheDocument();
  });
});

describe("safeCallback", () => {
  it("only allows same-origin paths", () => {
    expect(safeCallback("/courses/x")).toBe("/courses/x");
    expect(safeCallback("//evil.com")).toBe("/");
    expect(safeCallback("https://evil.com")).toBe("/");
    expect(safeCallback(null)).toBe("/");
  });
});
