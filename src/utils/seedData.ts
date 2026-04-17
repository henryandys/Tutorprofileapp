import { tutorAPI } from './api';

export const seedTutors = async () => {
  const tutors = [
    {
      name: "Alexandra Thompson",
      specialty: "Tennis Instruction",
      subjects: ["Tennis", "Sports Coaching"],
      rating: 4.9,
      hourlyRate: 75,
      experience: "8 years",
      bio: "Professional tennis coach with USPTA certification. Specialized in developing junior players and competitive training.",
      education: "Bachelor's in Kinesiology, USPTA Certified",
      location: { lat: 37.7749, lng: -122.4194 },
      address: "San Francisco, CA",
      imageUrl: "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400",
      ageGroups: ["Elementary", "Middle School", "High School"],
      availability: ["Weekday Evenings", "Weekends"],
    },
    {
      name: "Daniel Park",
      specialty: "Piano Instruction",
      subjects: ["Piano", "Music Theory", "Composition"],
      rating: 4.8,
      hourlyRate: 65,
      experience: "12 years",
      bio: "Classically trained pianist with a passion for teaching students of all ages. Specializes in classical, jazz, and contemporary styles.",
      education: "Master's in Music Performance, Royal Conservatory",
      location: { lat: 37.7849, lng: -122.4094 },
      address: "San Francisco, CA",
      imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      ageGroups: ["Elementary", "Middle School", "High School", "Adult"],
      availability: ["Weekday Afternoons", "Weekday Evenings"],
    },
    {
      name: "Sarah Martinez",
      specialty: "Mathematics",
      subjects: ["Algebra", "Calculus", "Geometry", "Statistics"],
      rating: 4.9,
      hourlyRate: 85,
      experience: "10 years",
      bio: "Former high school math teacher turned private tutor. Passionate about making complex concepts accessible and engaging.",
      education: "Master's in Mathematics Education, Stanford University",
      location: { lat: 37.7649, lng: -122.4294 },
      address: "San Francisco, CA",
      imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
      ageGroups: ["Middle School", "High School", "College"],
      availability: ["Weekday Afternoons", "Weekday Evenings", "Weekends"],
    },
    {
      name: "Michael Chen",
      specialty: "Computer Science",
      subjects: ["Python", "Java", "Web Development", "Data Structures"],
      rating: 4.7,
      hourlyRate: 95,
      experience: "6 years",
      bio: "Software engineer and coding instructor. Specializes in preparing students for AP Computer Science and tech careers.",
      education: "BS Computer Science, UC Berkeley",
      location: { lat: 37.7549, lng: -122.4394 },
      address: "San Francisco, CA",
      imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400",
      ageGroups: ["High School", "College", "Adult"],
      availability: ["Weekday Evenings", "Weekends"],
    },
    {
      name: "Emily Johnson",
      specialty: "English & Literature",
      subjects: ["Writing", "Literature", "SAT Prep", "Essay Writing"],
      rating: 5.0,
      hourlyRate: 80,
      experience: "15 years",
      bio: "Published author and experienced educator. Helps students develop strong writing and critical thinking skills.",
      education: "PhD in English Literature, Harvard University",
      location: { lat: 37.7949, lng: -122.4494 },
      address: "San Francisco, CA",
      imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
      ageGroups: ["Middle School", "High School", "College"],
      availability: ["Weekday Afternoons", "Weekends"],
    },
  ];

  const createdTutors = [];
  for (const tutor of tutors) {
    try {
      const result = await tutorAPI.create(tutor);
      createdTutors.push(result.tutor);
      console.log(`Created tutor: ${tutor.name}`);
    } catch (error) {
      console.error(`Failed to create tutor ${tutor.name}:`, error);
    }
  }

  return createdTutors;
};
