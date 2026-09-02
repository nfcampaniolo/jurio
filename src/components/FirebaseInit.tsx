"use client";

import { useEffect } from "react";
import { initializeOptionalServices } from "@/services/optionalService";

export default function FirebaseInit() {
  useEffect(() => {
    initializeOptionalServices();
  }, []);

  return null;
}