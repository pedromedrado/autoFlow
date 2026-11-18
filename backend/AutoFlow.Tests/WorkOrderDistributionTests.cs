using AutoFlow.Domain;
using Xunit;

public sealed class WorkOrderDistributionTests
{
    [Fact]
    public void NewOrderWaitsForWorkshopManager()
    {
        var order = new WorkOrder { Items = [new WorkOrderItem()] };
        Assert.Equal("Aguardando distribuição", order.Status);
    }

    [Fact]
    public void PartialAssignmentKeepsOrderInManagerQueue()
    {
        var order = new WorkOrder
        {
            Items = [
                new WorkOrderItem { MechanicId = "mechanic-a" },
                new WorkOrderItem()
            ]
        };
        Assert.Equal("Aguardando distribuição", order.Status);
    }

    [Fact]
    public void EveryServiceCanHaveADifferentMechanic()
    {
        var order = new WorkOrder
        {
            Items = [
                new WorkOrderItem { MechanicId = "mechanic-a" },
                new WorkOrderItem { MechanicId = "mechanic-b" }
            ]
        };
        Assert.Equal("Atribuída", order.Status);
        order.Items[1].MechanicId = null;
        Assert.Equal("Aguardando distribuição", order.Status);
    }
}
