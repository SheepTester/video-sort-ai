import { createContext, useContext } from "react";
import { Video } from "../api";

export type VideoContextValue = (video: Video) => void;

const VideoContext = createContext<VideoContextValue>(() => {});

export const VideoContextProvider = VideoContext.Provider;

export function useVideoContext(): VideoContextValue {
  return useContext(VideoContext);
}
