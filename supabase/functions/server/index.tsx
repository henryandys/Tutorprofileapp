import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-3c6c6b51/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== TUTOR ROUTES ====================

// Get all tutors
app.get("/make-server-3c6c6b51/tutors", async (c) => {
  try {
    const tutors = await kv.getByPrefix("tutor:");
    return c.json({ tutors });
  } catch (error) {
    console.log(`Error fetching all tutors: ${error}`);
    return c.json({ error: "Failed to fetch tutors" }, 500);
  }
});

// Get a specific tutor by ID
app.get("/make-server-3c6c6b51/tutors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const tutor = await kv.get(`tutor:${id}`);
    if (!tutor) {
      return c.json({ error: "Tutor not found" }, 404);
    }
    return c.json({ tutor });
  } catch (error) {
    console.log(`Error fetching tutor: ${error}`);
    return c.json({ error: "Failed to fetch tutor" }, 500);
  }
});

// Create a new tutor
app.post("/make-server-3c6c6b51/tutors", async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const tutor = {
      id,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`tutor:${id}`, tutor);
    return c.json({ tutor }, 201);
  } catch (error) {
    console.log(`Error creating tutor: ${error}`);
    return c.json({ error: "Failed to create tutor" }, 500);
  }
});

// Update a tutor
app.put("/make-server-3c6c6b51/tutors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existingTutor = await kv.get(`tutor:${id}`);
    if (!existingTutor) {
      return c.json({ error: "Tutor not found" }, 404);
    }
    const updatedTutor = {
      ...existingTutor,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`tutor:${id}`, updatedTutor);
    return c.json({ tutor: updatedTutor });
  } catch (error) {
    console.log(`Error updating tutor: ${error}`);
    return c.json({ error: "Failed to update tutor" }, 500);
  }
});

// Delete a tutor
app.delete("/make-server-3c6c6b51/tutors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`tutor:${id}`);
    return c.json({ message: "Tutor deleted successfully" });
  } catch (error) {
    console.log(`Error deleting tutor: ${error}`);
    return c.json({ error: "Failed to delete tutor" }, 500);
  }
});

// ==================== STUDENT ROUTES ====================

// Get all students
app.get("/make-server-3c6c6b51/students", async (c) => {
  try {
    const students = await kv.getByPrefix("student:");
    return c.json({ students });
  } catch (error) {
    console.log(`Error fetching all students: ${error}`);
    return c.json({ error: "Failed to fetch students" }, 500);
  }
});

// Get a specific student by ID
app.get("/make-server-3c6c6b51/students/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const student = await kv.get(`student:${id}`);
    if (!student) {
      return c.json({ error: "Student not found" }, 404);
    }
    return c.json({ student });
  } catch (error) {
    console.log(`Error fetching student: ${error}`);
    return c.json({ error: "Failed to fetch student" }, 500);
  }
});

// Create a new student
app.post("/make-server-3c6c6b51/students", async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const student = {
      id,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`student:${id}`, student);
    return c.json({ student }, 201);
  } catch (error) {
    console.log(`Error creating student: ${error}`);
    return c.json({ error: "Failed to create student" }, 500);
  }
});

// Update a student
app.put("/make-server-3c6c6b51/students/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existingStudent = await kv.get(`student:${id}`);
    if (!existingStudent) {
      return c.json({ error: "Student not found" }, 404);
    }
    const updatedStudent = {
      ...existingStudent,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`student:${id}`, updatedStudent);
    return c.json({ student: updatedStudent });
  } catch (error) {
    console.log(`Error updating student: ${error}`);
    return c.json({ error: "Failed to update student" }, 500);
  }
});

// ==================== RESOURCE ROUTES ====================

// Get all resources (with optional subject filter)
app.get("/make-server-3c6c6b51/resources", async (c) => {
  try {
    const subject = c.req.query("subject");
    const gradeLevel = c.req.query("gradeLevel");
    const school = c.req.query("school");

    let resources = await kv.getByPrefix("resource:");

    // Filter by subject if provided
    if (subject) {
      resources = resources.filter((r: any) => r.subject === subject);
    }

    // Filter by grade level if provided
    if (gradeLevel) {
      resources = resources.filter((r: any) => r.gradeLevel === gradeLevel);
    }

    // Filter by school if provided
    if (school) {
      resources = resources.filter((r: any) => r.school === school);
    }

    return c.json({ resources });
  } catch (error) {
    console.log(`Error fetching resources: ${error}`);
    return c.json({ error: "Failed to fetch resources" }, 500);
  }
});

// Get a specific resource by ID
app.get("/make-server-3c6c6b51/resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const resource = await kv.get(`resource:${id}`);
    if (!resource) {
      return c.json({ error: "Resource not found" }, 404);
    }
    return c.json({ resource });
  } catch (error) {
    console.log(`Error fetching resource: ${error}`);
    return c.json({ error: "Failed to fetch resource" }, 500);
  }
});

// Create a new resource
app.post("/make-server-3c6c6b51/resources", async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const resource = {
      id,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`resource:${id}`, resource);
    return c.json({ resource }, 201);
  } catch (error) {
    console.log(`Error creating resource: ${error}`);
    return c.json({ error: "Failed to create resource" }, 500);
  }
});

// Update a resource
app.put("/make-server-3c6c6b51/resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existingResource = await kv.get(`resource:${id}`);
    if (!existingResource) {
      return c.json({ error: "Resource not found" }, 404);
    }
    const updatedResource = {
      ...existingResource,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`resource:${id}`, updatedResource);
    return c.json({ resource: updatedResource });
  } catch (error) {
    console.log(`Error updating resource: ${error}`);
    return c.json({ error: "Failed to update resource" }, 500);
  }
});

// Delete a resource
app.delete("/make-server-3c6c6b51/resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`resource:${id}`);
    return c.json({ message: "Resource deleted successfully" });
  } catch (error) {
    console.log(`Error deleting resource: ${error}`);
    return c.json({ error: "Failed to delete resource" }, 500);
  }
});

// ==================== AVAILABILITY ROUTES ====================

// Get tutor availability
app.get("/make-server-3c6c6b51/availability/:tutorId", async (c) => {
  try {
    const tutorId = c.req.param("tutorId");
    const availability = await kv.get(`availability:${tutorId}`);
    if (!availability) {
      return c.json({ availability: [] });
    }
    return c.json({ availability });
  } catch (error) {
    console.log(`Error fetching availability: ${error}`);
    return c.json({ error: "Failed to fetch availability" }, 500);
  }
});

// Set tutor availability
app.post("/make-server-3c6c6b51/availability/:tutorId", async (c) => {
  try {
    const tutorId = c.req.param("tutorId");
    const body = await c.req.json();
    const availability = {
      tutorId,
      slots: body.slots,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`availability:${tutorId}`, availability);
    return c.json({ availability });
  } catch (error) {
    console.log(`Error setting availability: ${error}`);
    return c.json({ error: "Failed to set availability" }, 500);
  }
});

// ==================== GROUP SESSION ROUTES ====================

// Get all group sessions
app.get("/make-server-3c6c6b51/sessions", async (c) => {
  try {
    const sessions = await kv.getByPrefix("session:");
    return c.json({ sessions });
  } catch (error) {
    console.log(`Error fetching sessions: ${error}`);
    return c.json({ error: "Failed to fetch sessions" }, 500);
  }
});

// Get a specific session by ID
app.get("/make-server-3c6c6b51/sessions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const session = await kv.get(`session:${id}`);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json({ session });
  } catch (error) {
    console.log(`Error fetching session: ${error}`);
    return c.json({ error: "Failed to fetch session" }, 500);
  }
});

// Create a new group session
app.post("/make-server-3c6c6b51/sessions", async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const session = {
      id,
      ...body,
      participants: body.participants || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`session:${id}`, session);
    return c.json({ session }, 201);
  } catch (error) {
    console.log(`Error creating session: ${error}`);
    return c.json({ error: "Failed to create session" }, 500);
  }
});

// Update a session
app.put("/make-server-3c6c6b51/sessions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existingSession = await kv.get(`session:${id}`);
    if (!existingSession) {
      return c.json({ error: "Session not found" }, 404);
    }
    const updatedSession = {
      ...existingSession,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`session:${id}`, updatedSession);
    return c.json({ session: updatedSession });
  } catch (error) {
    console.log(`Error updating session: ${error}`);
    return c.json({ error: "Failed to update session" }, 500);
  }
});

// Delete a session
app.delete("/make-server-3c6c6b51/sessions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`session:${id}`);
    return c.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.log(`Error deleting session: ${error}`);
    return c.json({ error: "Failed to delete session" }, 500);
  }
});

// ==================== REVIEW ROUTES ====================

// Get reviews for a tutor
app.get("/make-server-3c6c6b51/reviews/tutor/:tutorId", async (c) => {
  try {
    const tutorId = c.req.param("tutorId");
    const allReviews = await kv.getByPrefix("review:");
    const tutorReviews = allReviews.filter((r: any) => r.tutorId === tutorId);
    return c.json({ reviews: tutorReviews });
  } catch (error) {
    console.log(`Error fetching reviews for tutor: ${error}`);
    return c.json({ error: "Failed to fetch reviews" }, 500);
  }
});

// Create a new review
app.post("/make-server-3c6c6b51/reviews", async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const review = {
      id,
      ...body,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`review:${id}`, review);
    return c.json({ review }, 201);
  } catch (error) {
    console.log(`Error creating review: ${error}`);
    return c.json({ error: "Failed to create review" }, 500);
  }
});

Deno.serve(app.fetch);