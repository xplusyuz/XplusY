/**
 * PLATFORM PROJECT CONFIG
 * Yo‘nalishdan mustaqil, USER markazli
 */

export const PROJECTS = {
  leadermath: {
    name: "LeaderMath Platform",

    // === AUTH ===
    auth: {
      type: "id_password", // id_password | telegram | none
      session: true,
      autoRegister: true
    },

    // === DATABASE ===
    database: {
      provider: "firebase"
    },

    // === CORE COLLECTIONS ===
    collections: {
      users: "foydalanuvchilar",
      sessions: "sessions",
      results: "results",
      profiles: "profiles",
      activity: "activity_logs"
    },

    // === ROLES ===
    roles: {
      admin: user => user?.role === "admin",
      user:  user => user?.role === "user",
      guest: () => true
    },

    // === PERMISSIONS (ENTITY → ACTION → ROLE) ===
    permissions: {
      users: {
        read: ["self", "admin"],
        update: ["self", "admin"]
      },
      results: {
        create: ["user"],
        read: ["self", "admin"]
      },
      profiles: {
        read: ["self", "admin"],
        update: ["self"]
      },
      activity: {
        create: ["system"],
        read: ["admin"]
      }
    }
  }
};
