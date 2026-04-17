import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3c6c6b51`;

const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    console.error(`API Error at ${endpoint}:`, error);
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

// ==================== TUTOR API ====================

export const tutorAPI = {
  getAll: async () => {
    return fetchAPI('/tutors');
  },

  getById: async (id: string) => {
    return fetchAPI(`/tutors/${id}`);
  },

  create: async (tutorData: any) => {
    return fetchAPI('/tutors', {
      method: 'POST',
      body: JSON.stringify(tutorData),
    });
  },

  update: async (id: string, tutorData: any) => {
    return fetchAPI(`/tutors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tutorData),
    });
  },

  delete: async (id: string) => {
    return fetchAPI(`/tutors/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== STUDENT API ====================

export const studentAPI = {
  getAll: async () => {
    return fetchAPI('/students');
  },

  getById: async (id: string) => {
    return fetchAPI(`/students/${id}`);
  },

  create: async (studentData: any) => {
    return fetchAPI('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  update: async (id: string, studentData: any) => {
    return fetchAPI(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  },
};

// ==================== RESOURCE API ====================

export const resourceAPI = {
  getAll: async (filters?: { subject?: string; gradeLevel?: string; school?: string }) => {
    const params = new URLSearchParams();
    if (filters?.subject) params.append('subject', filters.subject);
    if (filters?.gradeLevel) params.append('gradeLevel', filters.gradeLevel);
    if (filters?.school) params.append('school', filters.school);

    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchAPI(`/resources${query}`);
  },

  getById: async (id: string) => {
    return fetchAPI(`/resources/${id}`);
  },

  create: async (resourceData: any) => {
    return fetchAPI('/resources', {
      method: 'POST',
      body: JSON.stringify(resourceData),
    });
  },

  update: async (id: string, resourceData: any) => {
    return fetchAPI(`/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(resourceData),
    });
  },

  delete: async (id: string) => {
    return fetchAPI(`/resources/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== AVAILABILITY API ====================

export const availabilityAPI = {
  get: async (tutorId: string) => {
    return fetchAPI(`/availability/${tutorId}`);
  },

  set: async (tutorId: string, slots: any[]) => {
    return fetchAPI(`/availability/${tutorId}`, {
      method: 'POST',
      body: JSON.stringify({ slots }),
    });
  },
};

// ==================== SESSION API ====================

export const sessionAPI = {
  getAll: async () => {
    return fetchAPI('/sessions');
  },

  getById: async (id: string) => {
    return fetchAPI(`/sessions/${id}`);
  },

  create: async (sessionData: any) => {
    return fetchAPI('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  },

  update: async (id: string, sessionData: any) => {
    return fetchAPI(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sessionData),
    });
  },

  delete: async (id: string) => {
    return fetchAPI(`/sessions/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== REVIEW API ====================

export const reviewAPI = {
  getByTutor: async (tutorId: string) => {
    return fetchAPI(`/reviews/tutor/${tutorId}`);
  },

  create: async (reviewData: any) => {
    return fetchAPI('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  },
};
