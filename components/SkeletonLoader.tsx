
import React from 'react';

export const FeedSkeleton = () => {
  return (
    <div className="w-full h-full p-4 flex items-center justify-center">
      <div className="relative w-full max-w-lg h-full max-h-[75vh] rounded-[2rem] overflow-hidden bg-slate-200 animate-pulse flex flex-col">
        {/* Image Placeholder */}
        <div className="flex-1 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-200 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/20 skew-x-12 animate-shimmer"></div>
        </div>
        
        {/* Content Placeholder */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 flex flex-col gap-4">
           {/* Topic Tag */}
           <div className="w-32 h-8 bg-yellow-200 rounded-full animate-pulse"></div>
           {/* Text Lines */}
           <div className="w-full h-6 bg-slate-300 rounded-full"></div>
           <div className="w-3/4 h-6 bg-slate-300 rounded-full"></div>
           <div className="w-1/2 h-6 bg-slate-300 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export const VideoGridSkeleton = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
                    {/* Thumbnail */}
                    <div className="aspect-video bg-slate-700 animate-pulse relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-slate-600 rounded-full opacity-50"></div>
                        </div>
                    </div>
                    {/* Text */}
                    <div className="p-4 space-y-3">
                        <div className="w-24 h-3 bg-slate-600 rounded-full"></div>
                        <div className="w-full h-5 bg-slate-600 rounded-full"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};
