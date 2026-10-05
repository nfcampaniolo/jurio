"use client";

import { useEffect } from "react";
import { initializeOptionalServices } from "@/infrastructure/optionalService";

export default function FirebaseInit() {
  useEffect(() => {
    void initializeOptionalServices();
  }, []);

  return null;
}