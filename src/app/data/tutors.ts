export interface Tutor {
  id: string;
  name: string;
  subject: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  location: string;
  bio: string;
  imageUrl: string;
  education: string;
  experience: string;
  coordinates: { x: number; y: number }; // Percentage for the map
}

export const tutors: Tutor[] = [
  {
    id: "1",
    name: "Dr. Sarah Mitchell",
    subject: "Advanced Calculus & Physics",
    rating: 4.9,
    reviewCount: 124,
    hourlyRate: 85,
    location: "Downtown, Seattle",
    bio: "Ph.D. in Physics with over 10 years of experience helping students master complex mathematical concepts. I specialize in AP Physics and university-level Calculus.",
    imageUrl: "https://images.unsplash.com/photo-1590563152569-bd0b2dae4418?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB0dXRvciUyMGhlYWRzaG90JTIwcG9ydHJhaXQlMjBwZXJzb258ZW58MXx8fHwxNzcxNTI0NzExfDA&ixlib=rb-4.1.0&q=80&w=1080",
    education: "Ph.D. in Theoretical Physics, MIT",
    experience: "12 years teaching, 5 years private tutoring",
    coordinates: { x: 35, y: 42 }
  },
  {
    id: "2",
    name: "James Wilson",
    subject: "Computer Science & Python",
    rating: 4.8,
    reviewCount: 89,
    hourlyRate: 65,
    location: "Capitol Hill, Seattle",
    bio: "Software Engineer at a top tech firm. I love teaching coding fundamentals and helping students build their first applications in Python and JavaScript.",
    imageUrl: "https://images.unsplash.com/photo-1771050889377-b68415885c64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWxlJTIwcHJvZmVzc29yJTIwaGVhZHNob3QlMjBvZmZpY2V8ZW58MXx8fHwxNzcxNTI0NzExfDA&ixlib=rb-4.1.0&q=80&w=1080",
    education: "B.S. in Computer Science, Stanford",
    experience: "Senior Dev at BigTech, 4 years coding bootcamp instructor",
    coordinates: { x: 55, y: 38 }
  },
  {
    id: "3",
    name: "Emily Chen",
    subject: "SAT/ACT Prep & English",
    rating: 5.0,
    reviewCount: 210,
    hourlyRate: 75,
    location: "Queen Anne, Seattle",
    bio: "Specializing in test preparation and essay writing. I've helped hundreds of students increase their SAT scores by an average of 150 points.",
    imageUrl: "https://images.unsplash.com/photo-1758685848226-eedca8f6bce7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwdGVhY2hlciUyMHBvcnRyYWl0JTIwd29tYW4lMjBkZXNrfGVufDF8fHx8MTc3MTUyNDcxMXww&ixlib=rb-4.1.0&q=80&w=1080",
    education: "M.A. in English Literature, Columbia University",
    experience: "8 years professional test prep coach",
    coordinates: { x: 42, y: 58 }
  },
  {
    id: "4",
    name: "Marcus Thorne",
    subject: "Biology & Chemistry",
    rating: 4.7,
    reviewCount: 56,
    hourlyRate: 55,
    location: "Ballard, Seattle",
    bio: "Pre-med student with a passion for life sciences. I make complex biological systems easy to understand through visual learning and practical examples.",
    imageUrl: "https://images.unsplash.com/photo-1686543972836-ad63f87f984b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHN0dWRlbnQlMjB0dXRvciUyMGxpYnJhcnklMjBwZXJzb258ZW58MXx8fHwxNzcxNTI0NzExfDA&ixlib=rb-4.1.0&q=80&w=1080",
    education: "B.S. in Biology, University of Washington",
    experience: "3 years university lab assistant, 2 years tutoring",
    coordinates: { x: 28, y: 30 }
  },
  {
    id: "5",
    name: "Elena Rodriguez",
    subject: "Spanish & Latin History",
    rating: 4.9,
    reviewCount: 142,
    hourlyRate: 50,
    location: "Fremont, Seattle",
    bio: "Native Spanish speaker with a focus on conversational fluency and cultural history. Learning a language should be fun and immersive!",
    imageUrl: "https://images.unsplash.com/photo-1574130303188-31a915382726?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRseSUyMGZlbWFsZSUyMGVkdWNhdG9yJTIwY2xhc3Nyb29tfGVufDF8fHx8MTc3MTUyNDcxMXww&ixlib=rb-4.1.0&q=80&w=1080",
    education: "M.Ed. in Bilingual Education, UC Berkeley",
    experience: "15 years high school teacher",
    coordinates: { x: 48, y: 65 }
  },
  {
    id: "6",
    name: "Alexandra Thompson",
    subject: "Tennis & Athletic Performance",
    rating: 4.8,
    reviewCount: 78,
    hourlyRate: 70,
    location: "Magnolia, Seattle",
    bio: "Former collegiate tennis player and certified athletic coach. I help students of all levels improve their game through technique refinement, mental coaching, and fitness training.",
    imageUrl: "https://images.unsplash.com/photo-1660463527860-b66aebd362c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBjb2FjaCUyMGluc3RydWN0b3IlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzM2ODQzMzd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    education: "B.A. in Sports Science, UCLA",
    experience: "NCAA Division I player, 6 years professional coaching",
    coordinates: { x: 62, y: 52 }
  },
  {
    id: "7",
    name: "Daniel Park",
    subject: "Piano & Music Theory",
    rating: 5.0,
    reviewCount: 167,
    hourlyRate: 80,
    location: "Wallingford, Seattle",
    bio: "Concert pianist and music educator specializing in classical and contemporary piano. I teach proper technique, music theory, and help students prepare for recitals and competitions.",
    imageUrl: "https://images.unsplash.com/photo-1719526408259-c8491e25541e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWFubyUyMHRlYWNoZXIlMjBpbnN0cnVjdG9yJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzczNjg0MzM3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    education: "M.M. in Piano Performance, Juilliard School",
    experience: "10 years teaching, international performance experience",
    coordinates: { x: 70, y: 25 }
  }
];