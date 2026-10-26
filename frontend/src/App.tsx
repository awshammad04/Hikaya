/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { PersonalizedTourModal } from "./components/PersonalizedTourModal";
import { AboutPage } from "./pages/AboutPage";
import { ConstellationPage } from "./pages/ConstellationPage";
import { ContributePage } from "./pages/ContributePage";
import { HomePage } from "./pages/HomePage";
import { PalestineHomePage } from "./pages/PalestineHomePage";
import { GovernoratePage } from "./pages/GovernoratePage";
import { HeritageMapPage } from "./pages/HeritageMapPage";
import { CreateStoryPage } from "./pages/CreateStoryPage";
import { MyStoryPage } from "./pages/MyStoryPage";
import { LocationDetailsPage } from "./pages/LocationDetailsPage";
import { MapPage } from "./pages/MapPage";
import { AccountPage } from "./pages/AccountPage";
import { PassportPage } from "./pages/PassportPage";
import { ReviewPage } from "./pages/ReviewPage";

/**
 * Routes for the Sprint 2 MVP flow:
 *
 *   /                   home
 *   /map                interactive map of the archived locations
 *   /constellation      the archive drawn as a web of shared themes
 *   /locations/:id      details, reviewed stories, AI narrative, memories
 *   /contribute         user contribution form
 *   /about              project background
 *   /account            sign in or create an account (optional)
 *   /me                 "My passport": progress, photos, saved stories
 *   /admin/review       review queue for public stories (editors and admins)
 *   /explorer           legacy URL redirected to the current Jerusalem map
 *
 * Location ids are the same slugs used by the API and the content files
 * (for example 'muslim-quarter' and 'bab-al-amud'), so URLs stay readable.
 */
export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<PalestineHomePage />} />
            <Route path="jerusalem" element={<HomePage />} />
            <Route path="governorates/:governorateId" element={<GovernoratePage />} />
            <Route path="governorates/:governorateId/map" element={<HeritageMapPage />} />
            <Route path="governorates/:governorateId/create-story" element={<CreateStoryPage />} />
            <Route path="governorates/:governorateId/connections" element={<ConstellationPage />} />
            <Route path="palestine-connections" element={<ConstellationPage scope="all" />} />
            <Route path="palestine-map" element={<HeritageMapPage />} />
            <Route path="create-story" element={<CreateStoryPage />} />
            <Route path="my-story" element={<MyStoryPage />} />
            <Route path="plan-tour" element={<PersonalizedTourModal />} />
            <Route path="map" element={<MapPage />} />
            <Route path="locations/:locationId" element={<LocationDetailsPage />} />
            <Route path="constellation" element={<ConstellationPage />} />
            <Route path="contribute" element={<ContributePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="me" element={<PassportPage />} />
            <Route path="admin/review" element={<ReviewPage />} />
            <Route path="explorer" element={<Navigate to="/map" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
