  // --- Materials ---
  getMaterials: async (workId: string): Promise<Material[]> => {
    if (supabase) {
      const { data } = await supabase
        .from('materials')
        .select('*')
        .eq('work_id', workId);

      return (data || []).map(m => ({
        ...m,
        workId: m.work_id,
        plannedQty: m.planned_qty,
        purchasedQty: m.purchased_qty,
        stepId: m.step_id,
        category: m.category
      }));
    } else {
      const db = getLocalDb();
      return Promise.resolve(db.materials.filter(m => m.workId === workId));
    }
  },

  addMaterial: async (material: Omit<Material, 'id'>) => {
    if (supabase) {
      await supabase.from('materials').insert({
        work_id: material.workId,
        name: material.name,
        planned_qty: material.plannedQty,
        purchased_qty: material.purchasedQty,
        unit: material.unit,
        category: material.category || 'Geral'
      });
    } else {
      const db = getLocalDb();
      db.materials.push({
        ...material,
        id: Math.random().toString(36).substr(2, 9),
        category: material.category || 'Geral'
      });
      saveLocalDb(db);
    }
  },

  updateMaterial: async (material: Material, cost?: number) => {
    // 1. Atualiza o registro do material
    if (supabase) {
      await supabase
        .from('materials')
        .update({
          name: material.name,
          planned_qty: material.plannedQty,
          purchased_qty: material.purchasedQty,
          category: material.category,
          unit: material.unit
        })
        .eq('id', material.id);
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

      // Só tenta achar etapa se tiver categoria E workId definido
      if (!finalStepId && material.category && material.workId) {
        const steps = await dbService.getSteps(material.workId);
        const cat = material.category.toLowerCase().trim();

        const match = steps.find(s => {
          const name = s.name.toLowerCase().trim();
          return name === cat || name.includes(cat);
        });

        if (match) finalStepId = match.id;
      }

      const description = `Compra: ${material.name}`;

      // Aqui usamos non-null assertion porque um Material sem workId não faz sentido na lógica da app
      await dbService.addExpense({
        workId: material.workId!,
        description,
        amount: cost,
        paidAmount: cost,
        quantity: 1,
        category: ExpenseCategory.MATERIAL,
        date: new Date().toISOString().split('T')[0],
        stepId: finalStepId // se ficar undefined, seu fluxo trata como "Geral"
      });
    }
  },

  deleteMaterial: async (id: string) => {
    if (supabase) {
      await supabase.from('materials').delete().eq('id', id);
    } else {
      const db = getLocalDb();
      db.materials = db.materials.filter(m => m.id !== id);
      saveLocalDb(db);
    }
  },
