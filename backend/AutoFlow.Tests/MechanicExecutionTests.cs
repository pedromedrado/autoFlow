using AutoFlow.Domain;
using Xunit;

public sealed class MechanicExecutionTests
{
    [Fact]
    public void CompletingOneServiceDoesNotCompleteTheOrder()
    {
        var order = new WorkOrder
        {
            Items =
            [
                new WorkOrderItem { MechanicId = "a", StartedAt = DateTime.UtcNow, CompletedAt = DateTime.UtcNow },
                new WorkOrderItem { MechanicId = "b" }
            ]
        };
        Assert.Equal("Atribuída", order.Status);
    }

    [Fact]
    public void CompletedServicesSendTheOrderToInspection()
    {
        var order = new WorkOrder
        {
            Items = [new WorkOrderItem { MechanicId = "a", StartedAt = DateTime.UtcNow, CompletedAt = DateTime.UtcNow }]
        };
        Assert.Equal("Aguardando conferência", order.Status);
    }

    [Fact]
    public void ActiveServiceRemainsVisibleWhileOthersAwaitAssignment()
    {
        var order = new WorkOrder
        {
            Items =
            [
                new WorkOrderItem { MechanicId = "a", StartedAt = DateTime.UtcNow },
                new WorkOrderItem()
            ]
        };
        Assert.Equal("Em andamento", order.Status);
        order.Items[0].PausedAt = DateTime.UtcNow;
        Assert.Equal("Pausada", order.Status);
    }
}
