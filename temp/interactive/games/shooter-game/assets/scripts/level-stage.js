function getStageInfo(wave){
  if (wave <= 10){
    return { stage: 1, start: 0, end: 10 };
  } else if (wave <= 20){
    return { stage: 2, start: 11, end: 20 };
  } else {
    return { stage: 3, start: 21, end: 30 };
  }
}
