namespace AutoFlow.Domain;

public sealed class Store
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DealershipId { get; set; }
    public string Name { get; set; } = "";
    public string Document { get; set; } = "";
    public string City { get; set; } = "";
}

public sealed class CatalogService
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DealershipId { get; set; }
    public string Name { get; set; } = "";
    public int Minutes { get; set; }
    public decimal Price { get; set; }
}

public sealed class WorkOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DealershipId { get; set; }
    public Guid StoreId { get; set; }
    public string Customer { get; set; } = "";
    public string Vehicle { get; set; } = "";
    public string Plate { get; set; } = "";
    public string Consultant { get; set; } = "";
    public string? ManagerName { get; set; }
    public string Status => Items.Count > 0 && Items.All(item => item.Status == "Pronto") ? "Pronta"
        : Items.Any(item => item.Status == "Em execução") ? "Em andamento"
        : Items.Any(item => item.Status == "Pausado") ? "Pausada"
        : Items.Count > 0 && Items.All(item => item.CompletedAt.HasValue) ? "Aguardando conferência"
        : Items.Count == 0 || Items.Any(item => string.IsNullOrEmpty(item.MechanicId)) ? "Aguardando distribuição"
        : "Atribuída";
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public List<WorkOrderItem> Items { get; set; } = [];
}

public sealed class WorkOrderItem
{
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? PausedAt { get; set; }
    public long PausedSeconds { get; set; }
    public string? PauseReason { get; set; }
    public string? Report { get; set; }
    public int ExecutionVersion { get; set; }
    public string Status => CompletedAt.HasValue ? ApprovedAt.HasValue ? "Pronto" : "Concluído"
        : PausedAt.HasValue ? "Pausado" : StartedAt.HasValue ? "Em execução" : "Aguardando início";

    public string? MechanicId { get; set; }
    public string? MechanicName { get; set; }

    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkOrderId { get; set; }
    public string Name { get; set; } = "";
    public int Minutes { get; set; }
    public decimal Price { get; set; }
}
