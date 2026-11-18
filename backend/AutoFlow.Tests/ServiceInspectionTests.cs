using AutoFlow.Domain;
using Xunit;

public sealed class ServiceInspectionTests
{
    [Fact]
    public void PartialInspectionDoesNotMarkTheWholeOrderReady()
    {
        var now = DateTime.UtcNow;
        var order = new WorkOrder
        {
            Items =
            [
                new WorkOrderItem { MechanicId = "a", StartedAt = now, CompletedAt = now, ApprovedAt = now, ApprovedBy = "manager" },
                new WorkOrderItem { MechanicId = "b", StartedAt = now, CompletedAt = now }
            ]
        };
        Assert.Equal("Pronto", order.Items[0].Status);
        Assert.Equal("Concluído", order.Items[1].Status);
        Assert.Equal("Aguardando conferência", order.Status);
        order.Items[1].ApprovedAt = now;
        order.Items[1].ApprovedBy = "manager";
        Assert.Equal("Pronta", order.Status);
    }

    [Fact]
    public void InspectionCannotMakeAnUnfinishedServiceReady()
    {
        var item = new WorkOrderItem { MechanicId = "a", ApprovedAt = DateTime.UtcNow };
        Assert.Equal("Aguardando início", item.Status);
    }
}
