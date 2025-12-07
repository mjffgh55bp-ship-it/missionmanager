import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Award, Clock, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

export default function Qualifications() {
  const [qualifications, setQualifications] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workerQualifications, setWorkerQualifications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showQualDialog, setShowQualDialog] = useState(false);
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [editingQual, setEditingQual] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [qualFormData, setQualFormData] = useState({
    name: "",
    description: "",
    newbie_threshold_hours: 50,
    active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [qualsData, workersData, wqData, assignmentsData] = await Promise.all([
      base44.entities.Qualification.list("-created_date"),
      base44.entities.Worker.filter({ active: true }),
      base44.entities.WorkerQualification.list(),
      base44.entities.Assignment.list()
    ]);
    setQualifications(qualsData);
    setWorkers(workersData);
    setWorkerQualifications(wqData);
    setAssignments(assignmentsData);
  };

  const getWorkerQualificationHours = (workerId, qualificationId) => {
    return assignments
      .filter(a => 
        a.qualification_id === qualificationId && 
        (a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId)
      )
      .reduce((sum, a) => sum + (a.hours || 0), 0);
  };

  const hasWorkerQualification = (workerId, qualificationId) => {
    return workerQualifications.some(
      wq => wq.worker_id === workerId && wq.qualification_id === qualificationId
    );
  };

  const handleQualSubmit = async () => {
    if (editingQual) {
      await base44.entities.Qualification.update(editingQual.id, qualFormData);
    } else {
      await base44.entities.Qualification.create(qualFormData);
    }
    setShowQualDialog(false);
    setEditingQual(null);
    setQualFormData({ name: "", description: "", newbie_threshold_hours: 50, active: true });
    loadData();
  };

  const handleEditQual = (qual) => {
    setEditingQual(qual);
    setQualFormData({
      name: qual.name,
      description: qual.description || "",
      newbie_threshold_hours: qual.newbie_threshold_hours || 50,
      active: qual.active
    });
    setShowQualDialog(true);
  };

  const handleWorkerQualToggle = async (worker, qualification, hasQual) => {
    if (hasQual) {
      const wq = workerQualifications.find(
        wq => wq.worker_id === worker.id && wq.qualification_id === qualification.id
      );
      if (wq) {
        await base44.entities.WorkerQualification.delete(wq.id);
      }
    } else {
      await base44.entities.WorkerQualification.create({
        worker_id: worker.id,
        worker_name: worker.full_name,
        qualification_id: qualification.id,
        qualification_name: qualification.name,
        granted_date: format(new Date(), "yyyy-MM-dd")
      });
    }
    loadData();
  };

  const openWorkerDialog = (worker) => {
    setSelectedWorker(worker);
    setShowWorkerDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Qualifications</h1>
            <p className="text-gray-600">Manage qualifications and track worker progress</p>
          </div>
          <Button 
            onClick={() => setShowQualDialog(true)}
            className="bg-blue-900 hover:bg-blue-800 text-white px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Qualification
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {qualifications.filter(q => q.active).map((qual) => {
            const workersWithQual = workerQualifications.filter(wq => wq.qualification_id === qual.id);
            return (
              <Card key={qual.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        {qual.name}
                      </CardTitle>
                      {qual.description && (
                        <p className="text-sm text-gray-600 mt-1">{qual.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditQual(qual)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium">Workers</span>
                      </div>
                      <span className="text-lg font-bold text-blue-900">{workersWithQual.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium">Newbie Threshold</span>
                      </div>
                      <span className="text-lg font-bold text-amber-600">{qual.newbie_threshold_hours}h</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-none shadow-lg">
          <CardHeader className="border-b bg-white">
            <CardTitle>Worker Qualifications</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Worker</th>
                    {qualifications.filter(q => q.active).map(qual => (
                      <th key={qual.id} className="text-center p-3 font-semibold">{qual.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workers.map(worker => (
                    <tr key={worker.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <button
                          onClick={() => openWorkerDialog(worker)}
                          className="text-left hover:text-blue-900 font-medium"
                        >
                          {worker.full_name}
                        </button>
                      </td>
                      {qualifications.filter(q => q.active).map(qual => {
                        const hasQual = hasWorkerQualification(worker.id, qual.id);
                        const hours = getWorkerQualificationHours(worker.id, qual.id);
                        return (
                          <td key={qual.id} className="p-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Checkbox
                                checked={hasQual}
                                onCheckedChange={() => handleWorkerQualToggle(worker, qual, hasQual)}
                              />
                              {hasQual && (
                                <Badge variant="outline" className="text-xs">
                                  {hours}h
                                </Badge>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showQualDialog} onOpenChange={setShowQualDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingQual ? "Edit Qualification" : "Add New Qualification"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Qualification Name *</Label>
                <Input
                  id="name"
                  value={qualFormData.name}
                  onChange={(e) => setQualFormData({ ...qualFormData, name: e.target.value })}
                  placeholder="e.g., Pizza Specialist, Sushi Master"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={qualFormData.description}
                  onChange={(e) => setQualFormData({ ...qualFormData, description: e.target.value })}
                  placeholder="Describe this qualification..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="threshold">Newbie Threshold (Hours)</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={qualFormData.newbie_threshold_hours}
                  onChange={(e) => setQualFormData({ ...qualFormData, newbie_threshold_hours: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowQualDialog(false);
                setEditingQual(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleQualSubmit}
                disabled={!qualFormData.name}
                className="bg-blue-900 hover:bg-blue-800"
              >
                {editingQual ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showWorkerDialog} onOpenChange={setShowWorkerDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedWorker?.full_name} - Qualifications</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-3">
                {qualifications.filter(q => q.active).map(qual => {
                  const hasQual = hasWorkerQualification(selectedWorker?.id, qual.id);
                  const hours = getWorkerQualificationHours(selectedWorker?.id, qual.id);
                  const isNewbie = hasQual && hours < qual.newbie_threshold_hours;
                  return (
                    <div key={qual.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={hasQual}
                          onCheckedChange={() => handleWorkerQualToggle(selectedWorker, qual, hasQual)}
                        />
                        <div>
                          <p className="font-medium">{qual.name}</p>
                          {hasQual && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{hours}h worked</Badge>
                              {isNewbie && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  Newbie ({qual.newbie_threshold_hours - hours}h to expert)
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowWorkerDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}