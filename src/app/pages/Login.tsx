import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Mail, Lock, ArrowRight, Github, Chrome, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = (data: LoginForm) => {
    console.log("Login attempt:", data);
    toast.success("Welcome back! Logging you in...");
    setTimeout(() => {
      navigate("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Left Side - Visual/Marketing (Zillow Style) */}
      <div className="hidden md:flex md:w-1/2 bg-blue-600 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent opacity-30" />
          <div className="grid grid-cols-8 gap-4 transform -rotate-12 scale-150">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="aspect-square bg-white/10 rounded-xl" />
            ))}
          </div>
        </div>
        
        <div className="relative z-10 max-w-lg text-white">
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 font-black text-3xl shadow-2xl">
              T
            </div>
            <span className="text-3xl font-black tracking-tighter">TutorFind</span>
          </Link>
          
          <h1 className="text-5xl font-black leading-tight mb-6">
            Unlock your potential with the perfect tutor.
          </h1>
          <p className="text-xl text-blue-100 font-medium leading-relaxed mb-8">
            Join thousands of students who have found their path to academic success through our verified network of expert educators.
          </p>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/50 rounded-full flex items-center justify-center border border-white/20">
                <span className="font-bold">98%</span>
              </div>
              <p className="font-bold">Student satisfaction rate</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/50 rounded-full flex items-center justify-center border border-white/20">
                <span className="font-bold">15k+</span>
              </div>
              <p className="font-bold">Verified tutors active today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="md:hidden flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-4xl shadow-xl mb-4">
              T
            </div>
            <h2 className="text-2xl font-black text-gray-900">TutorFind</h2>
          </div>

          <header className="mb-10">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Sign In</h2>
            <p className="text-gray-500 font-medium">
              Don't have an account? <Link to="/become-a-tutor" className="text-blue-600 font-bold hover:underline">Join as a tutor</Link> or <Link to="/profile" className="text-blue-600 font-bold hover:underline">Sign up as student</Link>
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">EMAIL ADDRESS</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input 
                    {...register("email", { required: "Email is required", pattern: { value: /^\S+@\S+$/i, message: "Invalid email address" } })}
                    placeholder="name@example.com"
                    className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all"
                  />
                  {errors.email && <span className="text-xs text-red-500 font-bold mt-1 block">{errors.email.message}</span>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-end px-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">PASSWORD</label>
                  <a href="#" className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline">Forgot?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input 
                    {...register("password", { required: "Password is required", minLength: { value: 6, message: "Minimum 6 characters" } })}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full h-12 pl-12 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  {errors.password && <span className="text-xs text-red-500 font-bold mt-1 block">{errors.password.message}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-1">
              <input 
                type="checkbox" 
                id="remember" 
                {...register("rememberMe")}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="text-sm font-bold text-gray-600 cursor-pointer">Keep me signed in</label>
            </div>

            <button 
              type="submit"
              className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
            >
              Sign In
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="relative py-4 flex items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Or continue with</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button type="button" className="flex items-center justify-center gap-3 h-12 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-bold text-gray-700">
                <Chrome className="w-5 h-5 text-red-500" />
                Google
              </button>
              <button type="button" className="flex items-center justify-center gap-3 h-12 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-bold text-gray-700">
                <Github className="w-5 h-5" />
                GitHub
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-gray-400 font-medium mt-12 px-6">
            By signing in, you agree to our <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
