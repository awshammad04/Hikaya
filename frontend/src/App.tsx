/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { PalestineHomePage } from "./pages/PalestineHomePage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Every other page is its own chunk, loaded when first visited, so a phone
// opening the home page does not download the maps, the story tools and the
// passport up front. AppLayout shows a loading state meanwhile.
const page = <T extends Record<string, React.ComponentType>>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((module) => ({ default: module[name] })));
const PersonalizedTourModal = page(() => import("./components/PersonalizedTourModal"), "PersonalizedTourModal");
const AboutPage = page(() => import("./pages/AboutPage"), "AboutPage");
const ConstellationPage = page(() => import("./pages/ConstellationPage"), "ConstellationPage");
const ContributePage = page(() => import("./pages/ContributePage"), "ContributePage");
const PlacesPage = page(() => import("./pages/PlacesPage"), "PlacesPage");
const GovernoratePage = page(() => import("./pages/GovernoratePage"), "GovernoratePage");
const HeritageMapPage = page(() => import("./pages/HeritageMapPage"), "HeritageMapPage");
const CreateStoryPage = page(() => import("./pages/CreateStoryPage"), "CreateStoryPage");
const MyStoryPage = page(() => import("./pages/MyStoryPage"), "MyStoryPage");
const LocationDetailsPage = page(() => import("./pages/LocationDetailsPage"), "LocationDetailsPage");
const MapPage = page(() => import("./pages/MapPage"), "MapPage");
const AccountPage = page(() => import("./pages/AccountPage"), "AccountPage");
const PassportPage = page(() => import("./pages/PassportPage"), "PassportPage");
const LessonPackPage = page(() => import("./pages/LessonPackPage"), "LessonPackPage");
const ReviewPage = page(() => import("./pages/ReviewPage"), "ReviewPage");

/**
 * Routes for the Sprint 2 MVP flow:
 *
 *   /                   home
 *   /places             every place, with search and filters
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
            <Route path="places" element={<PlacesPage />} />
            <Route path="jerusalem" element={<Navigate to="/governorates/jerusalem" replace />} />
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
            <Route path="locations/:locationId/lesson" element={<LessonPackPage />} />
            <Route path="constellation" element={<ConstellationPage />} />
            <Route path="contribute" element={<ContributePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="me" element={<PassportPage />} />
            <Route path="admin/review" element={<ReviewPage />} />
            <Route path="explorer" element={<Navigate to="/map" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
