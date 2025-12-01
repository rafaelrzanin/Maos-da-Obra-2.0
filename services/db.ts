// ... (código anterior mantido)

  createWork: async (work: Omit<Work, 'id' | 'status'>, isConstructionMode: boolean = false): Promise<Work> => {
    // 1. CREATE WORK RECORD
    let newWorkId = '';
    
    if (supabase) {
        const { data: newWork, error } = await supabase.from('works').insert({
            user_id: work.userId,
            name: work.name,
            address: work.address,
            budget_planned: work.budgetPlanned,
            start_date: work.startDate,
            end_date: work.endDate,
            area: work.area,
            floors: work.floors || 1,
            notes: work.notes,
            status: WorkStatus.PLANNING
        }).select().single();

        if (error || !newWork) throw new Error("Failed to create work");
        newWorkId = newWork.id;

    } else {
        const db = getLocalDb();
        const created: Work = {
            ...work,
            id: Math.random().toString(36).substr(2, 9),
            status: WorkStatus.PLANNING,
            floors: work.floors || 1
        };
        db.works.push(created);
        saveLocalDb(db);
        newWorkId = created.id;
    }

    // 2. GENERATE INTELLIGENT PLAN (If Construction)
    if (isConstructionMode) {
        const plan = generateConstructionPlan(work.area, work.floors || 1);
        const startDate = new Date(work.startDate);

        // SEQUENTIAL INSERTION TO ENSURE ID LINKING
        for (const item of plan) {
            // Calculate dates
            const sDate = new Date(startDate);
            sDate.setDate(sDate.getDate() + item.startOffset);
            const eDate = new Date(sDate);
            eDate.setDate(eDate.getDate() + item.duration);

            // A. Create Step
            let stepId = '';
            if (supabase) {
                 const { data: newStep } = await supabase.from('steps').insert({
                    work_id: newWorkId,
                    name: item.stepName,
                    start_date: sDate.toISOString().split('T')[0],
                    end_date: eDate.toISOString().split('T')[0],
                    status: StepStatus.NOT_STARTED
                 }).select().single();
                 if (newStep) stepId = newStep.id;
            } else {
                 const db = getLocalDb();
                 stepId = Math.random().toString(36).substr(2, 9);
                 db.steps.push({
                     id: stepId,
                     workId: newWorkId,
                     name: item.stepName,
                     startDate: sDate.toISOString().split('T')[0],
                     endDate: eDate.toISOString().split('T')[0],
                     status: StepStatus.NOT_STARTED,
                     isDelayed: false
                 });
                 saveLocalDb(db);
            }

            // B. Create Linked Materials
            if (stepId && item.materials.length > 0) {
                 if (supabase) {
                    const matPayload = item.materials.map(m => ({
                        work_id: newWorkId,
                        name: m.name,
                        planned_qty: m.qty,
                        purchased_qty: 0,
                        unit: m.unit,
                        // CRITICAL FIX: Use stepName as category to group materials by activity visually
                        category: item.stepName, 
                        step_id: stepId 
                    }));
                    await supabase.from('materials').insert(matPayload);
                 } else {
                    const db = getLocalDb();
                    const matPayload = item.materials.map(m => ({
                        id: Math.random().toString(36).substr(2, 9),
                        workId: newWorkId,
                        name: m.name,
                        plannedQty: m.qty,
                        purchasedQty: 0,
                        unit: m.unit,
                        // CRITICAL FIX: Use stepName as category
                        category: item.stepName,
                        stepId: stepId
                    }));
                    db.materials.push(...matPayload);
                    saveLocalDb(db);
                 }
            }
        }
    }

    // Return the work object to the frontend
    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('id', newWorkId).single();
         return {
            ...data,
            userId: data.user_id,
            budgetPlanned: data.budget_planned,
            startDate: data.start_date,
            endDate: data.end_date,
            floors: data.floors
        };
    } else {
        const db = getLocalDb();
        return db.works.find(w => w.id === newWorkId)!;
    }
  },

// ... (restante do arquivo mantido)
