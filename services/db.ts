updateMaterial: async (material: Material, cost?: number) => {
    // 1. Update Material Record
    if (supabase) {
        await supabase.from('materials').update({
            name: material.name,
            planned_qty: material.plannedQty,
            purchased_qty: material.purchasedQty,
            category: material.category,
            unit: material.unit
        }).eq('id', material.id);
    } else {
        const db = getLocalDb();
        const idx = db.materials.findIndex(m => m.id === material.id);
        if (idx > -1) {
            db.materials[idx] = material;
            saveLocalDb(db);
        }
    }

    // 2. Se teve custo, lança automático nos gastos
    if (cost && cost > 0) {
        let finalStepId = material.stepId;

        // Só tenta achar etapa se tiver category E workId definido
        if (!finalStepId && material.category && material.workId) {
            const steps = await dbService.getSteps(material.workId);
            const match = steps.find(s =>
                s.name.toLowerCase().trim() === material.category.toLowerCase().trim() ||
                s.name.toLowerCase().includes(material.category.toLowerCase().trim())
            );
            if (match) finalStepId = match.id;
        }

        const description = `Compra: ${material.name}`;
        await dbService.addExpense({
            workId: material.workId!,              // aqui é seguro, porque se não tiver workId não faria sentido ter material
            description,
            amount: cost,
            paidAmount: cost,
            quantity: 1,
            category: ExpenseCategory.MATERIAL,
            date: new Date().toISOString().split('T')[0],
            stepId: finalStepId                    // pode ser undefined → vai pra "Geral" no front
        });
    }
},
