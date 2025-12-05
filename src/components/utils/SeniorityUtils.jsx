// Seniority progression rules
export const SENIORITY_LEVELS = {
  trainee: {
    label: "Trainee",
    color: "bg-orange-100 text-orange-800",
    borderColor: "border-orange-300",
    hoursRequired: 0,
    nextLevel: "newbie",
    hoursToNext: 50
  },
  newbie: {
    label: "Newbie",
    color: "bg-blue-100 text-blue-800",
    borderColor: "border-blue-300",
    hoursRequired: 50,
    nextLevel: "experienced_chef",
    hoursToNext: 150
  },
  experienced_chef: {
    label: "Experienced Chef",
    color: "bg-purple-100 text-purple-800",
    borderColor: "border-purple-300",
    hoursRequired: 200,
    nextLevel: null,
    hoursToNext: null
  }
};

export const getSeniorityInfo = (seniority) => {
  return SENIORITY_LEVELS[seniority] || SENIORITY_LEVELS.trainee;
};

export const calculateProgression = (totalHours, currentSeniority) => {
  const seniorityInfo = getSeniorityInfo(currentSeniority);
  
  if (!seniorityInfo.nextLevel) {
    return {
      progress: 100,
      hoursRemaining: 0,
      nextLevel: null
    };
  }
  
  const nextLevelInfo = getSeniorityInfo(seniorityInfo.nextLevel);
  const hoursIntoCurrentLevel = totalHours - seniorityInfo.hoursRequired;
  const hoursNeededForNext = nextLevelInfo.hoursRequired - seniorityInfo.hoursRequired;
  const progress = Math.min(100, (hoursIntoCurrentLevel / hoursNeededForNext) * 100);
  const hoursRemaining = Math.max(0, nextLevelInfo.hoursRequired - totalHours);
  
  return {
    progress,
    hoursRemaining,
    nextLevel: seniorityInfo.nextLevel
  };
};