async run({ query, trace }: { query: string; trace: MCPTraceEngine }) {
  // ===============================
  // 🔒 1. GOVERNOR PRE-CHECK
  // ===============================
  await this.governor.preCheck({ query });
  await trace.log({ type: "governor_precheck_passed" });

  // ===============================
  // 🧠 2. SYSTEM MEMORY LOAD
  // ===============================
  const systemBias = await getSystemMemory("agent_policy");
  const vectorBias = await getSystemMemory("vector_weights");

  await trace.log({
    type: "system_memory_loaded",
    systemBias,
    vectorBias,
  });

  // ===============================
  // 🔷 3. EMBEDDING + VECTOR SEARCH
  // ===============================
  const queryEmbedding = await this.embedQuery(query);

  const vectorResults = await this.vectorSearch(queryEmbedding);
  await trace.logVectorSearch(query, vectorResults.length);

  const nodeIds = vectorResults.map((v) => v.id);

  // ===============================
  // 🕸 4. GRAPH EXPANSION
  // ===============================
  const graphEdges = await this.graphTraversal(nodeIds);
  await trace.logGraphTraversal(nodeIds);

  // ===============================
  // 🧭 5. DECISION ENGINE (MEMORY-AWARE)
  // ===============================
  const decision = await this.decisionEngine.selectAgent({
    query,
    vectorResults,
    graphNodes: nodeIds,
    agents: AGENT_REGISTRY,
  });

  await trace.log({
    type: "agent_selected",
    agent: decision.id,
    score: decision.score,
    memoryInfluenced: decision.memoryInfluenced,
  });

  // ===============================
  // 🤖 6. AGENT EXECUTION
  // ===============================
  await trace.logAgentExecution(decision.id, "start");

  const result = await executeAgent(
    decision.id,
    {
      query,
      vector_results: vectorResults,
      graph_edges: graphEdges,
      selected_nodes: nodeIds,
    },
    { trace }
  );

  await trace.logAgentExecution(decision.id, "success");

  // ===============================
  // 📊 7. LEARNING PHASE
  // ===============================
  const signals = await this.learningBrain.fetchRecentSignals(50);

  await trace.log({
    type: "learning_snapshot",
    count: signals.length,
  });

  // ===============================
  // 🔁 8. AUTONOMY ANALYSIS
  // ===============================
  const autonomySignal = await this.autonomyEngine.analyze(signals);

  await trace.log({
    type: "autonomy_signal_generated",
    signal: autonomySignal?.type || null,
  });

  // ===============================
  // 🧠 9. GOVERNED MEMORY UPDATE
  // ===============================
  if (autonomySignal) {
    await this.governor.validateSystemChange({
      query,
      signal: autonomySignal,
    });

    await this.applySystemMemoryUpdate(autonomySignal, trace);
  }

  // ===============================
  // 🔒 10. GOVERNOR POST-CHECK
  // ===============================
  await this.governor.postCheck({
    query,
    agent: decision.id,
  });

  await trace.finish("success");

  // ===============================
  // 📦 FINAL RESPONSE
  // ===============================
  return {
    query,
    traceId: trace.getTraceId(),

    agent: decision,
    result,

    system_memory: {
      bias: systemBias,
      vector: vectorBias,
    },

    reasoning: {
      vector_hits: vectorResults,
      graph_edges: graphEdges,
      selected_nodes: nodeIds,
    },

    autonomy: autonomySignal || null,
  };
}
