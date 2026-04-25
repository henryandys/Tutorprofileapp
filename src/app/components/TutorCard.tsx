import React from "react";
import { Star, MapPin, Heart, Share2, MessageCircle } from "lucide-react";
import { Tutor } from "../data/tutors";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Link } from "react-router";

interface TutorCardProps {
  tutor: Tutor;
  isSelected?: boolean;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

export function TutorCard({ tutor, isSelected, isSaved, onToggleSave, onClick }: TutorCardProps) {
  const content = (
    <div className={`block relative rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow group ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden">
        {tutor.imageUrl ? (
          <ImageWithFallback
            src={tutor.imageUrl}
            alt={tutor.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
            <span className="text-white font-black select-none" style={{ fontSize: '72px', lineHeight: 1 }}>
              {tutor.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-800 uppercase tracking-wider">
          {tutor.subject.split(" & ")[0]}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSave?.(e);
          }}
          className={`absolute top-3 right-3 p-2 backdrop-blur-sm rounded-full transition-colors ${
            isSaved
              ? 'bg-red-500/90 hover:bg-red-600/90'
              : 'bg-white/20 hover:bg-white/40 group/heart'
          }`}
        >
          <Heart className={`w-5 h-5 transition-colors ${
            isSaved
              ? 'text-white fill-white'
              : 'text-white fill-transparent group-hover/heart:fill-red-500 group-hover/heart:text-red-500'
          }`} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-xl font-bold text-gray-900">${tutor.hourlyRate}/hr</h3>
          <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded text-blue-700 font-semibold text-sm">
            <Star className="w-3 h-3 fill-blue-700" />
            {tutor.rating}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="text-base font-bold text-gray-800 line-clamp-1">{tutor.name}</p>
          <p className="text-sm font-medium text-gray-600 line-clamp-1">{tutor.subject}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{tutor.location}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-tighter">
            {tutor.reviewCount} REVIEWS
          </span>
          <div className="flex items-center gap-3">
            <button className="text-gray-400 hover:text-blue-600 transition-colors"><MessageCircle className="w-4 h-4" /></button>
            <button className="text-gray-400 hover:text-blue-600 transition-colors"><Share2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <div onClick={onClick} className="w-full text-left cursor-pointer">
        {content}
      </div>
    );
  }

  return (
    <Link to={`/tutor/${tutor.id}`} className="block">
      {content}
    </Link>
  );
}