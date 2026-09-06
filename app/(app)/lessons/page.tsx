import Link from "next/link";
import type { Metadata } from "next";
import { Upload } from "lucide-react";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <>
      <PageHeader
        title="Lessons"
        description="Bilingual lesson plans built from the state syllabus."
        action={
          <Button asChild>
            <Link href="/lessons/upload">
              <Upload aria-hidden />
              Upload a lesson
            </Link>
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload and generate</CardTitle>
          <CardDescription>
            This part is built: upload a textbook page as a PDF, Word file,
            photo or text, and turn it into a teaching package you can edit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/lessons/upload">Open lesson upload</Link>
          </Button>
        </CardContent>
      </Card>

      <NotBuiltYet
        feature="The lesson library"
        phase={2}
        summary="Uploading and generating a lesson works. Browsing, searching and reopening saved lessons does not — saved lessons are in the database but there is no screen to list them yet."
        willInclude={[
          "List every saved lesson with its class, subject and status.",
          "Reopen a saved lesson and its teaching package for editing.",
          "Pin a lesson for offline use on a specific tablet.",
          "Track a lesson from draft to ready to archived.",
        ]}
      />
    </>
  );
}
