import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { computeChartSeries } from "@/lib/chartEngine";
import ChartRenderer from "./ChartRenderer";

export default function ChartDisplay({
  chart,
  workers, assignments, templateRows, allTemplates,
  trackers, trackerEntries,
  workerQualifications, qualifications,
  roleObjects, populationObjects,
  onEdit, onDelete,
}) {
  const series = useMemo(() => computeChartSeries(chart, {
    workers: workers || [],
    assignments: assignments || [],
    templateRows: templateRows || [],
    allTemplates: allTemplates || [],
    trackers: trackers || [],
    trackerEntries: trackerEntries || [],
    workerQualifications: workerQualifications || [],
    qualifications: qualifications || [],
    roleObjects: roleObjects || [],
    populationObjects: populationObjects || [],
  }), [chart, workers, assignments, templateRows, allTemplates, trackers, trackerEntries, workerQualifications, qualifications, roleObjects, populationObjects]);

  return (
    <Card className="border-none shadow-none h-full flex flex-col" dir="rtl">
      <CardHeader className="border-b py-2 px-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{chart.title}</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
              <Pencil className="w-3 h-3" />
            </Button>
            <ConfirmDeleteButton onConfirm={onDelete} variant="icon" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0 overflow-hidden">
        <ChartRenderer chart={chart} series={series} height={220} />
      </CardContent>
    </Card>
  );
}