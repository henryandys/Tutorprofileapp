import { useState } from 'react';
import { tutorAPI, studentAPI, resourceAPI, sessionAPI, reviewAPI, availabilityAPI } from '../../utils/api';
import { seedTutors } from '../../utils/seedData';

export function DatabaseTest() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tutors, setTutors] = useState<any[]>([]);

  const handleSeedDatabase = async () => {
    setLoading(true);
    setMessage('Seeding database...');
    try {
      const createdTutors = await seedTutors();
      setMessage(`✅ Successfully created ${createdTutors.length} tutors!`);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchTutors = async () => {
    setLoading(true);
    setMessage('Fetching tutors...');
    try {
      const result = await tutorAPI.getAll();
      setTutors(result.tutors);
      setMessage(`✅ Found ${result.tutors.length} tutors`);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestResource = async () => {
    setLoading(true);
    setMessage('Creating test resource...');
    try {
      const resource = await resourceAPI.create({
        title: "Algebra Worksheets",
        subject: "Mathematics",
        gradeLevel: "9th Grade",
        school: "Lincoln High School",
        description: "Practice problems for linear equations",
        uploadedBy: "test-tutor-id",
        fileUrl: "https://example.com/worksheet.pdf",
      });
      setMessage(`✅ Created resource: ${resource.resource.title}`);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSession = async () => {
    setLoading(true);
    setMessage('Creating test group session...');
    try {
      const session = await sessionAPI.create({
        title: "SAT Math Prep - Group Study",
        tutorId: "test-tutor-id",
        subject: "Mathematics",
        date: "2026-04-25",
        time: "6:00 PM",
        duration: "90 minutes",
        maxParticipants: 6,
        participants: [],
        price: 45,
        location: "Online (Zoom)",
      });
      setMessage(`✅ Created session: ${session.session.title}`);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Database Test Panel</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSeedDatabase}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Seed Tutors
          </button>
          <button
            onClick={handleFetchTutors}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Fetch All Tutors
          </button>
          <button
            onClick={handleTestResource}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Test Create Resource
          </button>
          <button
            onClick={handleTestSession}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            Test Create Session
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {tutors.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Tutors in Database ({tutors.length})</h2>
          <div className="space-y-3">
            {tutors.map((tutor) => (
              <div key={tutor.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="font-semibold">{tutor.name}</div>
                <div className="text-sm text-gray-600">
                  {tutor.specialty} • ${tutor.hourlyRate}/hr • Rating: {tutor.rating}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ID: {tutor.id}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Available API Endpoints</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-blue-600 mb-2">Tutors</h3>
            <ul className="space-y-1 text-gray-700">
              <li>• GET /tutors - List all tutors</li>
              <li>• GET /tutors/:id - Get tutor by ID</li>
              <li>• POST /tutors - Create tutor</li>
              <li>• PUT /tutors/:id - Update tutor</li>
              <li>• DELETE /tutors/:id - Delete tutor</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-green-600 mb-2">Students</h3>
            <ul className="space-y-1 text-gray-700">
              <li>• GET /students - List all students</li>
              <li>• GET /students/:id - Get student by ID</li>
              <li>• POST /students - Create student</li>
              <li>• PUT /students/:id - Update student</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-purple-600 mb-2">Resources</h3>
            <ul className="space-y-1 text-gray-700">
              <li>• GET /resources - List resources (filterable)</li>
              <li>• GET /resources/:id - Get resource by ID</li>
              <li>• POST /resources - Create resource</li>
              <li>• PUT /resources/:id - Update resource</li>
              <li>• DELETE /resources/:id - Delete resource</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-orange-600 mb-2">Sessions & More</h3>
            <ul className="space-y-1 text-gray-700">
              <li>• GET /sessions - List sessions</li>
              <li>• POST /sessions - Create session</li>
              <li>• GET /availability/:tutorId</li>
              <li>• POST /availability/:tutorId</li>
              <li>• GET /reviews/tutor/:tutorId</li>
              <li>• POST /reviews - Create review</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
