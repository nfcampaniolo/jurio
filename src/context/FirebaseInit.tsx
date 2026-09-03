"use client";

import { useEffect } from "react";
import { initializeOptionalServices } from "@/infrastructure/optionalService";

export default function FirebaseInit() {
  useEffect(() => {
    initializeOptionalServices();
  }, []);

  return null;
}